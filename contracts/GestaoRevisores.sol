// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice O que o GestaoRevisores precisa do OathChain.
interface IOathChain {
    function adicionarRevisorPelaGestao(address quem) external;
    function removerRevisorPelaGestao(address quem) external;
    function definirAprendizPelaGestao(address quem, bool ativo) external;
    function revisoresAtivos() external view returns (uint32);
    function ehRevisor(address quem) external view returns (bool);
}

/// @title GestaoRevisores: candidatura aberta, período de prova e promoção automática
/// @notice Ninguém "cadastra" revisores à mão. Qualquer pessoa se candidata com um depósito,
///         vira APRENDIZ (observa júris reais e vota sem contar no resultado) e é promovida a
///         REVISOR quando cumpre critérios objetivos de PARTICIPAÇÃO:
///           - votou (com justificativa e link) em pelo menos `minVotosProva` júris;
///           - tem no máximo `maxFaltas` faltas (foi sorteado e não participou);
///           - cumpriu o `periodoMinimoProva`;
///           - há vaga na janela de crescimento (limita a entrada de contas novas).
///         IMPORTANTE: o contrato NUNCA compara o voto do aprendiz com a maioria. Discordar não
///         custa nada; só não participar custa. Isso evita o efeito "maria vai com as outras":
///         o aprendiz é incentivado a pesquisar as fontes e chegar ao próprio veredito.
contract GestaoRevisores is Ownable {
    enum Estado { Nenhum, Aprendiz, Revisor, Saiu }

    struct Candidato {
        Estado estado;
        uint64 desde;           // início da prova (ou da última rebaixada)
        uint32 votosProva;      // votos revelados (com justificativa e link)
        uint32 faltas;          // sorteado e não participou
        uint256 deposito;       // saldo do depósito (já descontadas as multas)
    }

    IOathChain public immutable oath;

    uint256 public deposito = 0.01 ether;      // depósito de garantia (valor de teste)
    uint32 public minVotosProva = 5;
    uint32 public maxFaltas = 2;
    uint64 public periodoMinimoProva = 7 days;
    uint32 public multaPorFaltaPct = 20;       // % do depósito inicial perdido por falta
    uint64 public janelaCrescimento = 7 days;
    uint32 public crescimentoPct = 20;         // máx. de promoções por janela = 20% dos revisores (mín. 1)

    uint64 public inicioJanela;
    uint32 public promovidosNaJanela;
    uint256 public multasRetidas;              // multas ficam no contrato (futuro fundo de recompensa)

    mapping(address => Candidato) private candidatos;
    address[] private _lista;

    event Candidatou(address indexed quem, uint256 deposito);
    event Promovido(address indexed quem);
    event Rebaixado(address indexed quem, bool expulso);
    event Saiu(address indexed quem, uint256 devolvido);
    event Multa(address indexed quem, uint256 valor);
    event ParametrosAlterados();

    modifier soOath() {
        require(msg.sender == address(oath), "So o OathChain");
        _;
    }

    constructor(address oathChain) Ownable(msg.sender) {
        require(oathChain != address(0), "Endereco invalido");
        oath = IOathChain(oathChain);
    }

    // ---------------------------------------------------------------
    // Candidatura
    // ---------------------------------------------------------------

    function candidatar() external payable {
        Candidato storage c = candidatos[msg.sender];
        require(c.estado == Estado.Nenhum || c.estado == Estado.Saiu, "Ja candidato");
        require(!oath.ehRevisor(msg.sender), "Ja e revisor");
        require(msg.value >= deposito, "Deposito insuficiente");
        if (c.estado == Estado.Nenhum) _lista.push(msg.sender);
        c.estado = Estado.Aprendiz;
        c.desde = uint64(block.timestamp);
        c.votosProva = 0;
        c.faltas = 0;
        c.deposito += msg.value;
        oath.definirAprendizPelaGestao(msg.sender, true);
        emit Candidatou(msg.sender, msg.value);
    }

    // ---------------------------------------------------------------
    // Estatísticas (só o OathChain chama)
    // ---------------------------------------------------------------

    function registrarParticipacao(address quem) external soOath {
        Candidato storage c = candidatos[quem];
        if (c.estado == Estado.Aprendiz) c.votosProva += 1;
    }

    /// Falta = foi sorteado e não votou. Nunca é chamada por "discordar da maioria".
    function registrarFalta(address quem) external soOath {
        Candidato storage c = candidatos[quem];
        if (c.estado != Estado.Aprendiz && c.estado != Estado.Revisor) return;
        c.faltas += 1;
        uint256 multa = (deposito * multaPorFaltaPct) / 100;
        if (multa > c.deposito) multa = c.deposito;
        c.deposito -= multa;
        multasRetidas += multa;
        emit Multa(quem, multa);
    }

    // ---------------------------------------------------------------
    // Promoção, rebaixamento e saída (qualquer pessoa pode chamar)
    // ---------------------------------------------------------------

    function podePromover(address quem) public view returns (bool) {
        Candidato storage c = candidatos[quem];
        return c.estado == Estado.Aprendiz && c.votosProva >= minVotosProva && c.faltas <= maxFaltas
            && block.timestamp >= c.desde + periodoMinimoProva && _temVaga();
    }

    function promover(address quem) external {
        Candidato storage c = candidatos[quem];
        require(c.estado == Estado.Aprendiz, "Nao e aprendiz");
        require(c.votosProva >= minVotosProva, "Votos de prova insuficientes");
        require(c.faltas <= maxFaltas, "Faltas demais");
        require(block.timestamp >= c.desde + periodoMinimoProva, "Prova ainda nao terminou");
        require(_temVaga(), "Sem vaga nesta janela");
        if (block.timestamp >= inicioJanela + janelaCrescimento) {
            inicioJanela = uint64(block.timestamp);
            promovidosNaJanela = 0;
        }
        promovidosNaJanela += 1;
        c.estado = Estado.Revisor;
        c.faltas = 0;
        oath.definirAprendizPelaGestao(quem, false);
        oath.adicionarRevisorPelaGestao(quem);
        emit Promovido(quem);
    }

    /// Faltas acima do limite: revisor volta a aprendiz (recomeça a prova); aprendiz é expulso.
    function rebaixar(address quem) external {
        Candidato storage c = candidatos[quem];
        require(c.faltas > maxFaltas, "Dentro do limite de faltas");
        if (c.estado == Estado.Revisor) {
            oath.removerRevisorPelaGestao(quem);
            oath.definirAprendizPelaGestao(quem, true);
            c.estado = Estado.Aprendiz;
            c.desde = uint64(block.timestamp);
            c.votosProva = 0;
            c.faltas = 0;
            emit Rebaixado(quem, false);
        } else if (c.estado == Estado.Aprendiz) {
            oath.definirAprendizPelaGestao(quem, false);
            c.estado = Estado.Saiu;
            emit Rebaixado(quem, true);
        } else {
            revert("Nada a rebaixar");
        }
    }

    /// Sai voluntariamente (perde o papel) e recebe o depósito menos as multas.
    function sair() external {
        Candidato storage c = candidatos[msg.sender];
        require(c.estado == Estado.Aprendiz || c.estado == Estado.Revisor, "Nao participa");
        if (c.estado == Estado.Revisor) oath.removerRevisorPelaGestao(msg.sender);
        else oath.definirAprendizPelaGestao(msg.sender, false);
        c.estado = Estado.Saiu;
        _devolver(msg.sender);
    }

    /// Quem foi expulso recebe o que sobrou do depósito.
    function sacar() external {
        require(candidatos[msg.sender].estado == Estado.Saiu, "Ainda participa");
        _devolver(msg.sender);
    }

    function _devolver(address quem) private {
        Candidato storage c = candidatos[quem];
        uint256 valor = c.deposito;
        require(valor > 0, "Nada a devolver");
        c.deposito = 0;
        (bool ok, ) = quem.call{value: valor}("");
        require(ok, "Falha ao devolver");
        emit Saiu(quem, valor);
    }

    function _temVaga() private view returns (bool) {
        if (block.timestamp >= inicioJanela + janelaCrescimento) return true;
        uint256 limite = (uint256(oath.revisoresAtivos()) * crescimentoPct) / 100;
        if (limite < 1) limite = 1;
        return promovidosNaJanela < limite;
    }

    // ---------------------------------------------------------------
    // Consulta
    // ---------------------------------------------------------------

    function obterCandidato(address quem) external view returns (Candidato memory) {
        return candidatos[quem];
    }

    function listarCandidatos() external view returns (address[] memory) {
        return _lista;
    }

    // ---------------------------------------------------------------
    // Parâmetros (dono; na versão real, uma governança)
    // ---------------------------------------------------------------

    function definirParametros(
        uint256 novoDeposito,
        uint32 novoMinVotos,
        uint32 novoMaxFaltas,
        uint64 novoPeriodo,
        uint32 novaMultaPct,
        uint64 novaJanela,
        uint32 novoCrescimentoPct
    ) external onlyOwner {
        require(novoMinVotos >= 1 && novaMultaPct <= 100 && novaJanela > 0, "Parametros invalidos");
        deposito = novoDeposito;
        minVotosProva = novoMinVotos;
        maxFaltas = novoMaxFaltas;
        periodoMinimoProva = novoPeriodo;
        multaPorFaltaPct = novaMultaPct;
        janelaCrescimento = novaJanela;
        crescimentoPct = novoCrescimentoPct;
        emit ParametrosAlterados();
    }
}
