// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @title OathChain: livro-razão público de afirmações e promessas verificadas
/// @notice Versão 2. Um veredito só é gravado se mais de 50% dos revisores
///         (contados na abertura da verificação) concordarem com ele.
///         Guarda só hashes/CIDs; os arquivos ficam no IPFS.
contract OathChain is Ownable {
    // ---------------------------------------------------------------
    // 1) TIPOS
    // ---------------------------------------------------------------

    enum Tipo { Afirmacao, Promessa }

    // SemConsenso = ninguém teve mais de 50%: NENHUM veredito é gravado.
    enum Estado { Registrada, EmVerificacao, Finalizada, SemConsenso }

    enum Veredito {
        Nenhum,               // 0 = ainda não votou / sem veredito
        Verdadeira,           // afirmações
        Falsa,
        Inconclusiva,
        Cumprida,             // promessas
        ParcialmenteCumprida,
        NaoCumprida
    }

    struct Registro {
        uint256 id;
        address autor;
        Tipo tipo;
        string cidConteudo;     // link IPFS do texto
        bytes32 hashCriterios;  // hash dos critérios (promessas)
        uint64 prazo;           // timestamp de vencimento (promessas)
        uint64 criadoEm;
        Estado estado;
        uint32 rodada;          // sobe 1 a cada contestação
        Veredito resultado;     // só preenchido se estado == Finalizada
        // "Foto" tirada quando a rodada abre (não muda depois):
        uint32 totalRevisores;  // quantos revisores existiam
        uint32 epocaAbertura;   // define quem pode votar nesta rodada
        uint64 fimVotacao;      // até quando se pode votar
    }

    struct Fonte {
        string cid;
        bytes32 hashConteudo;
        address anexadaPor;
        uint64 data;
        uint32 rodada;          // em que rodada foi anexada
    }

    // ---------------------------------------------------------------
    // 2) VARIÁVEIS DE ESTADO
    // ---------------------------------------------------------------

    uint32 public constant MAX_RODADAS = 3;  // 1 votação inicial + até 2 contestações

    uint256 public proximoId = 1;
    uint32 public minRevisores = 3;          // mínimo para abrir uma verificação
    uint64 public janelaVotacao = 7 days;    // duração de cada rodada de votação

    mapping(uint256 => Registro) private registros;
    mapping(uint256 => Fonte[]) private fontes;

    // Revisores
    mapping(address => bool) public ehRevisor;
    mapping(address => uint32) public revisorEpoca; // "época" em que entrou
    uint32 public revisoresAtivos;
    uint32 public epoca;                             // sobe a cada revisor novo

    // id => rodada => revisor => voto
    mapping(uint256 => mapping(uint32 => mapping(address => Veredito))) private votos;
    // id => rodada => veredito => quantidade de votos
    mapping(uint256 => mapping(uint32 => mapping(Veredito => uint256))) private contagem;
    // id => rodada => total de votos
    mapping(uint256 => mapping(uint32 => uint256)) private totalVotos;

    // O autor só pode contestar uma vez
    mapping(uint256 => bool) public autorJaContestou;

    // ---------------------------------------------------------------
    // 3) EVENTOS
    // ---------------------------------------------------------------

    event RegistroCriado(uint256 indexed id, address indexed autor, Tipo tipo, string cidConteudo);
    event FonteAnexada(uint256 indexed id, uint32 rodada, string cid, bytes32 hashConteudo, address anexadaPor);
    event VerificacaoAberta(uint256 indexed id, uint32 rodada, uint32 totalRevisores, uint64 fimVotacao);
    event VotoRegistrado(uint256 indexed id, uint32 rodada, address indexed revisor, Veredito voto, string cidJustificativa);
    event Finalizado(uint256 indexed id, uint32 rodada, Veredito resultado);
    event SemConsenso(uint256 indexed id, uint32 rodada);
    event Contestado(uint256 indexed id, address indexed quem, uint32 novaRodada, string cidMotivo);
    event RevisorAlterado(address indexed revisor, bool ativo);

    constructor() Ownable(msg.sender) {}

    // ---------------------------------------------------------------
    // 4) ADMINISTRAÇÃO (só o dono)
    // ---------------------------------------------------------------

    function definirRevisor(address revisor, bool ativo) external onlyOwner {
        if (ativo && !ehRevisor[revisor]) {
            epoca += 1;
            revisorEpoca[revisor] = epoca;
            ehRevisor[revisor] = true;
            revisoresAtivos += 1;
            emit RevisorAlterado(revisor, true);
        } else if (!ativo && ehRevisor[revisor]) {
            ehRevisor[revisor] = false;
            revisoresAtivos -= 1;
            emit RevisorAlterado(revisor, false);
        }
    }

    function definirMinRevisores(uint32 novo) external onlyOwner {
        require(novo >= 1, "Minimo invalido");
        minRevisores = novo;
    }

    function definirJanelaVotacao(uint64 novaJanela) external onlyOwner {
        require(novaJanela > 0, "Janela invalida");
        janelaVotacao = novaJanela;
    }

    // ---------------------------------------------------------------
    // 5) REGISTRAR
    // ---------------------------------------------------------------

    function registrarAfirmacao(string calldata cidConteudo) external returns (uint256) {
        return _criar(Tipo.Afirmacao, cidConteudo, bytes32(0), 0);
    }

    function registrarPromessa(
        string calldata cidConteudo,
        bytes32 hashCriterios,
        uint64 prazo
    ) external returns (uint256) {
        require(prazo > block.timestamp, "Prazo deve estar no futuro");
        require(hashCriterios != bytes32(0), "Criterios obrigatorios");
        return _criar(Tipo.Promessa, cidConteudo, hashCriterios, prazo);
    }

    function _criar(
        Tipo tipo,
        string calldata cidConteudo,
        bytes32 hashCriterios,
        uint64 prazo
    ) private returns (uint256 id) {
        require(bytes(cidConteudo).length > 0, "CID vazio");
        id = proximoId++;
        Registro storage r = registros[id];
        r.id = id;
        r.autor = msg.sender;
        r.tipo = tipo;
        r.cidConteudo = cidConteudo;
        r.hashCriterios = hashCriterios;
        r.prazo = prazo;
        r.criadoEm = uint64(block.timestamp);
        r.estado = Estado.Registrada;
        r.rodada = 1;
        emit RegistroCriado(id, msg.sender, tipo, cidConteudo);
    }

    /// @notice Antes da verificação, qualquer pessoa anexa fontes.
    ///         Durante a verificação, só revisores habilitados nesta rodada.
    function anexarFonte(uint256 id, string calldata cid, bytes32 hashConteudo) external {
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        if (r.estado == Estado.EmVerificacao) {
            require(_podeVotar(r, msg.sender), "Fonte so por revisor");
        } else {
            require(r.estado == Estado.Registrada, "Registro encerrado");
        }
        fontes[id].push(Fonte(cid, hashConteudo, msg.sender, uint64(block.timestamp), r.rodada));
        emit FonteAnexada(id, r.rodada, cid, hashConteudo, msg.sender);
    }

    // ---------------------------------------------------------------
    // 6) VERIFICAÇÃO E VOTAÇÃO
    // ---------------------------------------------------------------

    /// @notice Promessa: qualquer pessoa, depois do prazo.
    ///         Afirmação: só o autor, quando as fontes já estiverem anexadas.
    function abrirVerificacao(uint256 id) external {
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        require(r.estado == Estado.Registrada, "Estado invalido");
        if (r.tipo == Tipo.Promessa) {
            require(block.timestamp >= r.prazo, "Prazo ainda nao venceu");
        } else {
            require(msg.sender == r.autor, "So o autor abre afirmacao");
        }
        _abrirRodada(r);
    }

    function _abrirRodada(Registro storage r) private {
        require(revisoresAtivos >= minRevisores, "Revisores insuficientes");
        r.estado = Estado.EmVerificacao;
        r.resultado = Veredito.Nenhum;
        r.totalRevisores = revisoresAtivos;
        r.epocaAbertura = epoca;
        r.fimVotacao = uint64(block.timestamp) + janelaVotacao;
        emit VerificacaoAberta(r.id, r.rodada, r.totalRevisores, r.fimVotacao);
    }

    function votar(uint256 id, Veredito voto, string calldata cidJustificativa) external {
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        require(r.estado == Estado.EmVerificacao, "Nao esta em verificacao");
        require(block.timestamp < r.fimVotacao, "Janela de votacao encerrada");
        require(_podeVotar(r, msg.sender), "Apenas revisores");
        require(msg.sender != r.autor, "Autor nao pode votar");
        require(_vereditoValido(r.tipo, voto), "Veredito invalido para o tipo");
        require(votos[id][r.rodada][msg.sender] == Veredito.Nenhum, "Ja votou nesta rodada");

        votos[id][r.rodada][msg.sender] = voto;
        contagem[id][r.rodada][voto] += 1;
        totalVotos[id][r.rodada] += 1;

        emit VotoRegistrado(id, r.rodada, msg.sender, voto, cidJustificativa);
    }

    /// @notice Regra: o veredito vence quando tem MAIS DE 50% dos revisores da rodada.
    ///         Sem maioria (todos votaram, ou a janela acabou) => SemConsenso:
    ///         nenhum veredito é gravado.
    function finalizar(uint256 id) external {
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        require(r.estado == Estado.EmVerificacao, "Nao esta em verificacao");

        Veredito vencedor = _vencedor(id, r.rodada, r.totalRevisores);
        if (vencedor != Veredito.Nenhum) {
            r.resultado = vencedor;
            r.estado = Estado.Finalizada;
            emit Finalizado(id, r.rodada, vencedor);
            return;
        }

        require(
            block.timestamp >= r.fimVotacao || totalVotos[id][r.rodada] >= r.totalRevisores,
            "Sem maioria ainda"
        );
        r.estado = Estado.SemConsenso;
        emit SemConsenso(id, r.rodada);
    }

    /// @notice Contesta um veredito finalizado: abre uma nova rodada.
    ///         O autor pode contestar só 1 vez e há no máximo MAX_RODADAS rodadas por registro.
    ///         Rodadas antigas ficam guardadas.
    function contestar(uint256 id, string calldata cidMotivo) external {
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        require(r.estado == Estado.Finalizada, "So se pode contestar apos finalizar");
        require(r.rodada < MAX_RODADAS, "Limite de rodadas atingido");

        if (msg.sender == r.autor) {
            require(!autorJaContestou[id], "Autor ja contestou uma vez");
            autorJaContestou[id] = true;
        } else {
            require(ehRevisor[msg.sender], "Sem permissao");
        }

        r.rodada += 1;
        _abrirRodada(r);
        emit Contestado(id, msg.sender, r.rodada, cidMotivo);
    }

    // ---------------------------------------------------------------
    // 7) CONSULTA
    // ---------------------------------------------------------------

    function obterRegistro(uint256 id) external view returns (Registro memory) {
        require(_existe(id), "Registro inexistente");
        return registros[id];
    }

    /// @notice true somente se houve maioria. É isto que a interface deve mostrar como "verificado".
    function ehVerificado(uint256 id) external view returns (bool) {
        return _existe(id) && registros[id].estado == Estado.Finalizada;
    }

    function obterFontes(uint256 id) external view returns (Fonte[] memory) {
        return fontes[id];
    }

    function obterVoto(uint256 id, uint32 rodada, address revisor) external view returns (Veredito) {
        return votos[id][rodada][revisor];
    }

    function obterContagem(uint256 id, uint32 rodada, Veredito v) external view returns (uint256) {
        return contagem[id][rodada][v];
    }

    // ---------------------------------------------------------------
    // 8) AUXILIARES
    // ---------------------------------------------------------------

    function _existe(uint256 id) private view returns (bool) {
        return id > 0 && id < proximoId;
    }

    /// Revisor ativo E que já era revisor quando a rodada abriu.
    function _podeVotar(Registro storage r, address quem) private view returns (bool) {
        return ehRevisor[quem] && revisorEpoca[quem] <= r.epocaAbertura;
    }

    /// Devolve o veredito com mais de 50% dos revisores, ou Nenhum.
    function _vencedor(uint256 id, uint32 rodada, uint32 total) private view returns (Veredito) {
        for (uint8 i = 1; i <= 6; i++) {
            if (contagem[id][rodada][Veredito(i)] * 2 > total) {
                return Veredito(i);
            }
        }
        return Veredito.Nenhum;
    }

    function _vereditoValido(Tipo tipo, Veredito v) private pure returns (bool) {
        if (tipo == Tipo.Afirmacao) {
            return v == Veredito.Verdadeira || v == Veredito.Falsa || v == Veredito.Inconclusiva;
        }
        return v == Veredito.Cumprida || v == Veredito.ParcialmenteCumprida || v == Veredito.NaoCumprida;
    }
}
