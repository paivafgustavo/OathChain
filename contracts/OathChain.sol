// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";

/// @notice Interface mínima do contrato de gestão dos revisores (candidatura e período de prova).
interface IGestao {
    function registrarParticipacao(address quem) external;
    function registrarFalta(address quem) external;
}

/// @title OathChain: livro-razão público de afirmações e promessas verificadas
/// @notice Versão 5 (verificação híbrida + júri sorteado + voto secreto). Uma IA verifica primeiro (veredito PROVISÓRIO) e os
///         revisores humanos entram só para recorrer. Um veredito só é gravado se mais de 50% dos revisores
///         (contados na abertura da verificação) concordarem com ele.
///         - O veredito é uma "foto datada": pode ser contestado só durante a janela de contestação.
///         - Se um fato mudar depois, um NOVO registro (afirmação) pode substituir o antigo.
///         Guarda só hashes/CIDs; os arquivos ficam no IPFS.
contract OathChain is Ownable {
    // ---------------------------------------------------------------
    // 1) TIPOS
    // ---------------------------------------------------------------

    enum Tipo { Afirmacao, Promessa }

    // SemConsenso = ninguém teve mais de 50%: NENHUM veredito é gravado.
    // Provisoria = veredito da IA aguardando a janela de recurso dos revisores humanos.
    enum Estado { Registrada, EmVerificacao, Finalizada, SemConsenso, Provisoria }

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
        // Veredito como "foto datada":
        uint64 finalizadoEm;    // quando o veredito foi gravado
        uint64 fimContestacao;  // até quando se pode contestar
        // Afirmações:
        string referencia;      // período a que a afirmação se refere (ex.: "2025")
        uint256 substitui;      // id do registro que este corrige (0 = nenhum)
        uint256 superadaPor;    // id do registro que superou este (0 = nenhum)
    }

    /// Configuração e estado do júri de UMA rodada (snapshot feito na abertura).
    struct Juri {
        uint32 tamanho;          // 0 = modo antigo (todos os revisores votam)
        uint32 aprendizes;       // quantos aprendizes observam (não contam no resultado)
        bool secreto;            // voto em duas etapas (commit-reveal)
        bool sorteado;
        uint64 bloco;            // bloco futuro cujo hash decide o sorteio
        uint64 fimCompromisso;   // até quando se pode "selar" o voto
    }

    struct Fonte {
        string cid;
        bytes32 hashConteudo;
        address anexadaPor;
        uint64 data;
        uint32 rodada;          // em que rodada foi anexada
    }

    /// Resultado da verificação automática (IA) de uma afirmação.
    struct VerificacaoIA {
        Veredito veredito;       // veredito proposto pela IA
        uint8 confianca;         // 0 a 100
        bytes32 hashRelatorio;   // hash do relatório completo (agentes, debate, fontes)
        string urlRelatorio;     // onde ler o relatório (depois, um CID do IPFS)
        uint64 em;               // quando a IA registrou
        uint64 fimRevisao;       // até quando os humanos podem recorrer (só se provisório)
    }

    // ---------------------------------------------------------------
    // 2) VARIÁVEIS DE ESTADO
    // ---------------------------------------------------------------

    uint32 public constant MAX_RODADAS = 3;  // 1 votação inicial + até 2 contestações

    uint256 public proximoId = 1;
    uint32 public minRevisores = 3;          // mínimo para abrir uma verificação
    uint64 public janelaVotacao = 7 days;    // duração de cada rodada de votação
    uint64 public janelaContestacao = 7 days; // tempo para contestar depois de finalizar

    // Verificação por IA
    address public agenteVerificador;        // carteira do serviço que roda os agentes de IA
    uint64 public janelaRevisaoIA = 3 days;  // tempo para humanos recorrerem do veredito da IA
    uint8 public limiteConfianca = 70;       // abaixo disso, a afirmação vai direto para os revisores
    mapping(uint256 => VerificacaoIA) private verificacoesIA;

    mapping(uint256 => Registro) private registros;
    mapping(uint256 => Fonte[]) private fontes;

    // Revisores
    mapping(address => bool) public ehRevisor;
    mapping(address => uint32) public revisorEpoca; // "época" em que entrou
    mapping(address => uint64) public revisorDesde; // quando entrou pela primeira vez (timestamp)
    address[] private _revisores;                   // todos que já foram cadastrados (sem repetir)
    uint32 public revisoresAtivos;
    uint32 public epoca;                             // sobe a cada revisor novo

    // id => rodada => revisor => voto
    mapping(uint256 => mapping(uint32 => mapping(address => Veredito))) private votos;
    // id => rodada => veredito => quantidade de votos
    mapping(uint256 => mapping(uint32 => mapping(Veredito => uint256))) private contagem;
    // id => rodada => total de votos
    mapping(uint256 => mapping(uint32 => uint256)) private totalVotos;

    // Júri sorteado e voto secreto
    uint32 public tamanhoJuri = 5;           // 0 = todos os revisores votam (modo antigo)
    uint32 public aprendizesPorJuri = 2;
    bool public votoSecreto = false;     // padrão: voto aberto, justificativa junto com o voto
    address public gestao;                   // contrato GestaoRevisores (candidatura + prova)
    address[] private _aprendizes;           // aprendizes ativos (observadores)
    mapping(address => uint256) private _idxAprendiz; // índice + 1
    mapping(uint256 => mapping(uint32 => Juri)) private juri;
    mapping(uint256 => mapping(uint32 => address[])) private jurados;
    mapping(uint256 => mapping(uint32 => address[])) private observadores;
    // 0 = não participa, 1 = jurado (voto conta), 2 = aprendiz (voto só observa)
    mapping(uint256 => mapping(uint32 => mapping(address => uint8))) private papel;
    mapping(uint256 => mapping(uint32 => mapping(address => bytes32))) private compromissos;
    mapping(uint256 => mapping(uint32 => uint32)) private revelados;

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
    event VerificacaoIARegistrada(
        uint256 indexed id, Veredito veredito, uint8 confianca, bytes32 hashRelatorio, string urlRelatorio, bool provisoria
    );
    event RecursoDaIA(uint256 indexed id, address indexed quem, string motivo);
    event IAConfirmada(uint256 indexed id, Veredito veredito);
    event AgenteVerificadorAlterado(address indexed agente);
    event Superada(uint256 indexed antigo, uint256 indexed novo);
    event SuperacaoRevertida(uint256 indexed antigo, uint256 indexed novo);
    event Contestado(uint256 indexed id, address indexed quem, uint32 novaRodada, string cidMotivo);
    event RevisorAlterado(address indexed revisor, bool ativo);
    event JuriConfigurado(uint32 tamanho, uint32 aprendizes, bool secreto);
    event GestaoAlterada(address indexed gestao);
    event SorteioAdiado(uint256 indexed id, uint32 rodada, uint64 novoBloco);
    event JuradosSorteados(uint256 indexed id, uint32 rodada, address[] jurados, address[] aprendizes, uint64 fimCompromisso, uint64 fimVotacao);
    event VotoSelado(uint256 indexed id, uint32 rodada, address indexed quem);
    event VotoRevelado(
        uint256 indexed id, uint32 rodada, address indexed quem, uint8 papel, Veredito voto, string justificativa, string linkFonte
    );
    event FaltaDeParticipacao(uint256 indexed id, uint32 rodada, address indexed quem);
    event AprendizAlterado(address indexed quem, bool ativo);

    modifier soGestao() {
        require(msg.sender == gestao && gestao != address(0), "So o contrato de gestao");
        _;
    }

    constructor() Ownable(msg.sender) {}

    // ---------------------------------------------------------------
    // 4) ADMINISTRAÇÃO (só o dono)
    // ---------------------------------------------------------------

    function definirRevisor(address revisor, bool ativo) external onlyOwner {
        _definirRevisor(revisor, ativo);
    }

    function definirJuri(uint32 tamanho, uint32 aprendizes, bool secreto) external onlyOwner {
        require(tamanho == 0 || tamanho >= 3, "Juri minimo: 3");
        require(!secreto || tamanho > 0, "Voto secreto exige juri");
        tamanhoJuri = tamanho;
        aprendizesPorJuri = aprendizes;
        votoSecreto = secreto;
        emit JuriConfigurado(tamanho, aprendizes, secreto);
    }

    function definirGestao(address novo) external onlyOwner {
        gestao = novo;
        emit GestaoAlterada(novo);
    }

    // --- chamadas feitas pelo contrato de gestão (candidatura automática) ---

    function adicionarRevisorPelaGestao(address quem) external soGestao {
        _definirRevisor(quem, true);
    }

    function removerRevisorPelaGestao(address quem) external soGestao {
        _definirRevisor(quem, false);
    }

    function definirAprendizPelaGestao(address quem, bool ativo) external soGestao {
        uint256 i = _idxAprendiz[quem];
        if (ativo && i == 0) {
            _aprendizes.push(quem);
            _idxAprendiz[quem] = _aprendizes.length;
            emit AprendizAlterado(quem, true);
        } else if (!ativo && i != 0) {
            address ultimo = _aprendizes[_aprendizes.length - 1];
            _aprendizes[i - 1] = ultimo;
            _idxAprendiz[ultimo] = i;
            _aprendizes.pop();
            delete _idxAprendiz[quem];
            emit AprendizAlterado(quem, false);
        }
    }

    function _definirRevisor(address revisor, bool ativo) private {
        if (ativo && !ehRevisor[revisor]) {
            epoca += 1;
            revisorEpoca[revisor] = epoca;
            if (revisorDesde[revisor] == 0) {
                revisorDesde[revisor] = uint64(block.timestamp);
                _revisores.push(revisor);
            }
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

    function definirAgenteVerificador(address agente) external onlyOwner {
        agenteVerificador = agente;
        emit AgenteVerificadorAlterado(agente);
    }

    function definirJanelaRevisaoIA(uint64 novaJanela) external onlyOwner {
        require(novaJanela > 0, "Janela invalida");
        janelaRevisaoIA = novaJanela;
    }

    function definirLimiteConfianca(uint8 novoLimite) external onlyOwner {
        require(novoLimite <= 100, "Limite invalido");
        limiteConfianca = novoLimite;
    }

    function definirJanelaContestacao(uint64 novaJanela) external onlyOwner {
        require(novaJanela > 0, "Janela invalida");
        janelaContestacao = novaJanela;
    }

    // ---------------------------------------------------------------
    // 5) REGISTRAR
    // ---------------------------------------------------------------

    /// @param referencia periodo a que a afirmacao se refere (ex.: "2025"). Obrigatorio.
    /// @param substituiId id de uma afirmacao FINALIZADA que esta corrige (0 = nenhuma).
    function registrarAfirmacao(
        string calldata cidConteudo,
        string calldata referencia,
        uint256 substituiId
    ) external returns (uint256 id) {
        require(bytes(referencia).length > 0, "Referencia obrigatoria");
        if (substituiId != 0) {
            require(_existe(substituiId), "Registro a substituir inexistente");
            Registro storage antigo = registros[substituiId];
            require(antigo.tipo == Tipo.Afirmacao, "So afirmacao substitui afirmacao");
            require(antigo.estado == Estado.Finalizada, "So se substitui registro finalizado");
        }
        id = _criar(Tipo.Afirmacao, cidConteudo, bytes32(0), 0);
        registros[id].referencia = referencia;
        registros[id].substitui = substituiId;
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
            require(_participa(id, r, msg.sender), "Fonte so por revisor");
        } else {
            require(r.estado == Estado.Registrada, "Registro encerrado");
        }
        fontes[id].push(Fonte(cid, hashConteudo, msg.sender, uint64(block.timestamp), r.rodada));
        emit FonteAnexada(id, r.rodada, cid, hashConteudo, msg.sender);
    }

    // ---------------------------------------------------------------
    // 5b) VERIFICAÇÃO POR IA (veredito provisório + recurso humano)
    // ---------------------------------------------------------------

    /// @notice O serviço de IA registra o veredito proposto para uma afirmação.
    ///         Confiança alta: vira PROVISÓRIO e os humanos podem recorrer por `janelaRevisaoIA`.
    ///         Confiança baixa (ou "Inconclusiva"): vai direto para a votação dos revisores.
    function registrarVerificacaoIA(
        uint256 id,
        Veredito veredito,
        uint8 confianca,
        bytes32 hashRelatorio,
        string calldata urlRelatorio
    ) external {
        require(msg.sender == agenteVerificador, "Apenas o agente verificador");
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        require(r.tipo == Tipo.Afirmacao, "IA so verifica afirmacoes");
        require(r.estado == Estado.Registrada, "Estado invalido");
        require(_vereditoValido(Tipo.Afirmacao, veredito), "Veredito invalido para o tipo");
        require(confianca <= 100, "Confianca invalida");
        require(hashRelatorio != bytes32(0), "Relatorio obrigatorio");

        VerificacaoIA storage v = verificacoesIA[id];
        v.veredito = veredito;
        v.confianca = confianca;
        v.hashRelatorio = hashRelatorio;
        v.urlRelatorio = urlRelatorio;
        v.em = uint64(block.timestamp);

        bool provisoria = !(veredito == Veredito.Inconclusiva || confianca < limiteConfianca);
        if (provisoria) {
            r.estado = Estado.Provisoria;
            v.fimRevisao = uint64(block.timestamp) + janelaRevisaoIA;
        } else {
            _abrirRodada(r); // vai direto para os revisores humanos
        }
        emit VerificacaoIARegistrada(id, veredito, confianca, hashRelatorio, urlRelatorio, provisoria);
    }

    /// @notice O autor ou um revisor pede que humanos reavaliem o veredito provisório da IA.
    ///         Não gasta a contestação do autor: é o "recurso" previsto no desenho híbrido.
    function recorrerDaIA(uint256 id, string calldata motivo) external {
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        require(r.estado == Estado.Provisoria, "Nao ha veredito provisorio");
        require(block.timestamp < verificacoesIA[id].fimRevisao, "Janela de recurso encerrada");
        require(msg.sender == r.autor || ehRevisor[msg.sender], "Sem permissao");
        _abrirRodada(r);
        emit RecursoDaIA(id, msg.sender, motivo);
    }

    /// @notice Passada a janela sem recurso, qualquer pessoa confirma o veredito da IA.
    ///         Como a janela de recurso já foi a janela de contestação, o veredito nasce definitivo.
    function confirmarIA(uint256 id) external {
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        require(r.estado == Estado.Provisoria, "Nao ha veredito provisorio");
        VerificacaoIA storage v = verificacoesIA[id];
        require(block.timestamp >= v.fimRevisao, "Janela de recurso ainda aberta");

        r.resultado = v.veredito;
        r.estado = Estado.Finalizada;
        r.finalizadoEm = uint64(block.timestamp);
        r.fimContestacao = uint64(block.timestamp); // já passou pela janela de recurso
        emit Finalizado(id, r.rodada, v.veredito);
        emit IAConfirmada(id, v.veredito);
        if (r.substitui != 0) _aplicarSubstituicao(r);
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
        r.finalizadoEm = 0;
        r.fimContestacao = 0;
        r.epocaAbertura = epoca;
        if (tamanhoJuri == 0) {
            // modo antigo: todos os revisores votam
            r.totalRevisores = revisoresAtivos;
            r.fimVotacao = uint64(block.timestamp) + janelaVotacao;
        } else {
            // modo júri: o sorteio acontece depois, com o hash de um bloco futuro
            r.totalRevisores = 0;
            r.fimVotacao = 0;
            juri[r.id][r.rodada] = Juri(tamanhoJuri, aprendizesPorJuri, votoSecreto, false, uint64(block.number + 3), 0);
        }
        emit VerificacaoAberta(r.id, r.rodada, r.totalRevisores, r.fimVotacao);
    }

    /// @notice Sorteia o júri usando o hash de um bloco que NÃO existia quando a verificação foi aberta.
    ///         Qualquer pessoa chama. Ninguém (nem o autor) consegue escolher os jurados.
    ///         O autor e os jurados da rodada anterior ficam de fora (se houver revisores suficientes).
    function sortearJurados(uint256 id) external {
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        require(r.estado == Estado.EmVerificacao, "Nao esta em verificacao");
        Juri storage j = juri[id][r.rodada];
        require(j.tamanho > 0 && !j.sorteado, "Nada a sortear");
        require(block.number > j.bloco, "Aguarde o bloco do sorteio");
        bytes32 h = blockhash(j.bloco);
        if (h == bytes32(0)) {
            // passaram mais de 256 blocos: o hash não está mais disponível, adia o sorteio
            j.bloco = uint64(block.number + 3);
            emit SorteioAdiado(id, r.rodada, j.bloco);
            return;
        }

        (address[] memory pool, uint256 nA) = _candidatos(id, r);
        uint256 q = j.tamanho < pool.length ? j.tamanho : pool.length;
        require(q >= minRevisores, "Jurados insuficientes");
        _tirar(id, r.rodada, pool, nA, q, uint256(h) ^ id, 1);
        // aprendizes observadores (não contam no resultado)
        (address[] memory ap, uint256 nAp) = _candidatosAprendiz(r.autor);
        if (nAp > 0 && j.aprendizes > 0) {
            _tirar(id, r.rodada, ap, nAp, j.aprendizes < nAp ? j.aprendizes : nAp, uint256(h) ^ id ^ 1, 2);
        }
        j.sorteado = true;
        r.totalRevisores = uint32(q);
        j.fimCompromisso = uint64(block.timestamp) + janelaVotacao / 2;
        r.fimVotacao = uint64(block.timestamp) + janelaVotacao;
        emit JuradosSorteados(id, r.rodada, jurados[id][r.rodada], observadores[id][r.rodada], j.fimCompromisso, r.fimVotacao);
    }

    /// Piscina de candidatos: primeiro quem NÃO foi jurado na rodada anterior (grupo A), depois os demais.
    function _candidatos(uint256 id, Registro storage r) private view returns (address[] memory pool, uint256 nA) {
        address[] memory tmp = new address[](_revisores.length);
        uint256 n;
        for (uint256 k = 0; k < 2; k++) {
            for (uint256 i = 0; i < _revisores.length; i++) {
                address c = _revisores[i];
                if (!ehRevisor[c] || revisorEpoca[c] > r.epocaAbertura || c == r.autor) continue;
                bool anterior = r.rodada > 1 && papel[id][r.rodada - 1][c] == 1;
                if (anterior == (k == 1)) tmp[n++] = c;
            }
            if (k == 0) nA = n;
        }
        pool = new address[](n);
        for (uint256 i = 0; i < n; i++) pool[i] = tmp[i];
    }

    function _candidatosAprendiz(address autor) private view returns (address[] memory ap, uint256 n) {
        ap = new address[](_aprendizes.length);
        for (uint256 i = 0; i < _aprendizes.length; i++) {
            if (_aprendizes[i] != autor) ap[n++] = _aprendizes[i];
        }
    }

    /// Sorteio sem repetição (Fisher-Yates parcial): primeiro dentro do grupo A, depois do B.
    function _tirar(uint256 id, uint32 rodada, address[] memory pool, uint256 nA, uint256 q, uint256 seed, uint8 p) private {
        uint256 n = pool.length;
        for (uint256 k = 0; k < q; k++) {
            uint256 hi = k < nA ? nA : n;
            uint256 pos = k + (uint256(keccak256(abi.encode(seed, k))) % (hi - k));
            (pool[k], pool[pos]) = (pool[pos], pool[k]);
            if (p == 1) jurados[id][rodada].push(pool[k]);
            else observadores[id][rodada].push(pool[k]);
            papel[id][rodada][pool[k]] = p;
        }
    }

    /// @notice Voto secreto, etapa 1 (primeira metade da janela): grava só o hash do voto.
    ///         hash = keccak256(abi.encode(veredito, sal, quem, id, rodada))
    function comprometerVoto(uint256 id, bytes32 hashVoto) external {
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        Juri storage j = juri[id][r.rodada];
        require(r.estado == Estado.EmVerificacao && j.sorteado && j.secreto, "Voto secreto indisponivel");
        require(block.timestamp < j.fimCompromisso, "Etapa de selar encerrada");
        require(papel[id][r.rodada][msg.sender] != 0, "Voce nao foi sorteado");
        require(hashVoto != bytes32(0), "Hash vazio");
        require(compromissos[id][r.rodada][msg.sender] == bytes32(0), "Ja selou o voto");
        compromissos[id][r.rodada][msg.sender] = hashVoto;
        emit VotoSelado(id, r.rodada, msg.sender);
    }

    /// @notice Voto secreto, etapa 2 (segunda metade): revela o voto com justificativa e link de fonte.
    function revelarVoto(
        uint256 id,
        Veredito voto,
        bytes32 sal,
        string calldata justificativa,
        string calldata linkFonte
    ) external {
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        Juri storage j = juri[id][r.rodada];
        require(r.estado == Estado.EmVerificacao && j.sorteado && j.secreto, "Voto secreto indisponivel");
        require(block.timestamp >= j.fimCompromisso, "Aguarde a etapa de revelar");
        require(block.timestamp < r.fimVotacao, "Janela de votacao encerrada");
        bytes32 c = compromissos[id][r.rodada][msg.sender];
        require(c != bytes32(0), "Voce nao selou um voto");
        require(votos[id][r.rodada][msg.sender] == Veredito.Nenhum, "Ja revelou");
        require(keccak256(abi.encode(voto, sal, msg.sender, id, r.rodada)) == c, "Voto nao confere com o selo");
        require(_vereditoValido(r.tipo, voto), "Veredito invalido para o tipo");
        _exigirFundamentacao(justificativa, linkFonte);
        _contarVoto(id, r, voto, justificativa, linkFonte);
    }

    function _exigirFundamentacao(string calldata justificativa, string calldata linkFonte) private pure {
        require(bytes(justificativa).length >= 40, "Justificativa curta demais");
        bytes calldata l = bytes(linkFonte);
        require(l.length >= 12 && l[0] == "h" && l[1] == "t" && l[2] == "t" && l[3] == "p", "Link de fonte invalido");
    }

    function _contarVoto(uint256 id, Registro storage r, Veredito voto, string memory just, string memory link) private {
        uint8 p = papel[id][r.rodada][msg.sender];
        votos[id][r.rodada][msg.sender] = voto;
        revelados[id][r.rodada] += 1;
        if (p == 1) {
            contagem[id][r.rodada][voto] += 1;
            totalVotos[id][r.rodada] += 1;
        }
        emit VotoRevelado(id, r.rodada, msg.sender, p, voto, just, link);
        _avisarGestao(abi.encodeCall(IGestao.registrarParticipacao, (msg.sender)));
    }

    /// Avisa o contrato de gestão sem nunca travar a votação se ele falhar.
    function _avisarGestao(bytes memory dados) private {
        if (gestao != address(0)) {
            (bool ok, ) = gestao.call{gas: 300000}(dados);
            ok;
        }
    }

    /// Checagens comuns a qualquer voto direto (sem selo).
    function _checarVotoDireto(uint256 id, Veredito voto) private view returns (Registro storage r, Juri storage j) {
        require(_existe(id), "Registro inexistente");
        r = registros[id];
        require(r.estado == Estado.EmVerificacao, "Nao esta em verificacao");
        j = juri[id][r.rodada];
        require(!j.secreto, "Use o voto secreto");
        require(r.fimVotacao != 0, "Sorteio pendente");
        require(block.timestamp < r.fimVotacao, "Janela de votacao encerrada");
        require(_participa(id, r, msg.sender), "Apenas revisores");
        require(msg.sender != r.autor, "Autor nao pode votar");
        require(_vereditoValido(r.tipo, voto), "Veredito invalido para o tipo");
        require(votos[id][r.rodada][msg.sender] == Veredito.Nenhum, "Ja votou nesta rodada");
    }

    /// @notice Modo antigo (sem júri): todos os revisores votam, justificativa por CID.
    function votar(uint256 id, Veredito voto, string calldata cidJustificativa) external {
        (Registro storage r, Juri storage j) = _checarVotoDireto(id, voto);
        require(j.tamanho == 0, "Use votarComJustificativa");
        votos[id][r.rodada][msg.sender] = voto;
        contagem[id][r.rodada][voto] += 1;
        totalVotos[id][r.rodada] += 1;
        emit VotoRegistrado(id, r.rodada, msg.sender, voto, cidJustificativa);
    }

    /// @notice Modo júri com voto ABERTO: voto, justificativa (>= 40 caracteres) e link de fonte
    ///         vão juntos, numa única transação, durante toda a janela de votação.
    function votarComJustificativa(
        uint256 id,
        Veredito voto,
        string calldata justificativa,
        string calldata linkFonte
    ) external {
        (Registro storage r, Juri storage j) = _checarVotoDireto(id, voto);
        require(j.tamanho > 0, "Use votar");
        _exigirFundamentacao(justificativa, linkFonte);
        _contarVoto(id, r, voto, justificativa, linkFonte);
    }

    /// @notice Regra: o veredito vence quando tem MAIS DE 50% dos revisores da rodada.
    ///         Sem maioria (todos votaram, ou a janela acabou) => SemConsenso:
    ///         nenhum veredito é gravado.
    function finalizar(uint256 id) external {
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        require(r.estado == Estado.EmVerificacao, "Nao esta em verificacao");

        Juri storage j = juri[id][r.rodada];
        if (j.tamanho > 0) {
            require(j.sorteado, "Sorteio pendente");
            // só encerra antes do prazo se TODOS (jurados e aprendizes) já revelaram
            require(
                block.timestamp >= r.fimVotacao ||
                    revelados[id][r.rodada] >= jurados[id][r.rodada].length + observadores[id][r.rodada].length,
                "Aguarde o fim da votacao"
            );
            _penalizarFaltas(id, r.rodada);
        }

        Veredito vencedor = _vencedor(id, r.rodada, r.totalRevisores);
        if (vencedor != Veredito.Nenhum) {
            r.resultado = vencedor;
            r.estado = Estado.Finalizada;
            r.finalizadoEm = uint64(block.timestamp);
            r.fimContestacao = uint64(block.timestamp) + janelaContestacao;
            emit Finalizado(id, r.rodada, vencedor);
            if (r.substitui != 0) _aplicarSubstituicao(r);
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
    ///         O autor pode contestar só 1 vez, há no máximo MAX_RODADAS rodadas por registro
    ///         e só dá para contestar durante a janela de contestação.
    ///         Rodadas antigas ficam guardadas.
    function contestar(uint256 id, string calldata cidMotivo) external {
        require(_existe(id), "Registro inexistente");
        Registro storage r = registros[id];
        require(r.estado == Estado.Finalizada, "So se pode contestar apos finalizar");
        require(r.rodada < MAX_RODADAS, "Limite de rodadas atingido");
        require(block.timestamp < r.fimContestacao, "Janela de contestacao encerrada");

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

    function obterVerificacaoIA(uint256 id) external view returns (VerificacaoIA memory) {
        require(_existe(id), "Registro inexistente");
        return verificacoesIA[id];
    }

    /// @notice true quando o veredito não pode mais ser contestado (janela fechou ou limite de rodadas).
    ///         Atenção: "definitivo" não significa "verdade eterna". Um fato que mudou depois
    ///         se corrige com um NOVO registro que substitui este.
    function ehDefinitivo(uint256 id) external view returns (bool) {
        if (!_existe(id)) return false;
        Registro storage r = registros[id];
        if (r.estado != Estado.Finalizada) return false;
        return block.timestamp >= r.fimContestacao || r.rodada >= MAX_RODADAS;
    }

    /// @notice Todos os endereços que já foram revisores. Confira `ehRevisor` para saber quem está ativo.
    function obterRevisores() external view returns (address[] memory) {
        return _revisores;
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

    function obterJuri(uint256 id, uint32 rodada)
        external
        view
        returns (Juri memory info, address[] memory osJurados, address[] memory osAprendizes)
    {
        return (juri[id][rodada], jurados[id][rodada], observadores[id][rodada]);
    }

    function obterPapel(uint256 id, uint32 rodada, address quem) external view returns (uint8) {
        return papel[id][rodada][quem];
    }

    function obterCompromisso(uint256 id, uint32 rodada, address quem) external view returns (bytes32) {
        return compromissos[id][rodada][quem];
    }

    function _existe(uint256 id) private view returns (bool) {
        return id > 0 && id < proximoId;
    }

    /// Quando um registro que SUBSTITUI outro é finalizado como Verdadeira, o antigo passa a
    /// "superado". Se a correção for derrubada em uma contestação, a substituição é desfeita.
    function _aplicarSubstituicao(Registro storage novo) private {
        Registro storage antigo = registros[novo.substitui];
        if (novo.resultado == Veredito.Verdadeira) {
            if (antigo.superadaPor == 0) {
                antigo.superadaPor = novo.id;
                emit Superada(antigo.id, novo.id);
            }
        } else if (antigo.superadaPor == novo.id) {
            antigo.superadaPor = 0;
            emit SuperacaoRevertida(antigo.id, novo.id);
        }
    }

    /// Quem sorteado não votou ganha uma "falta" no contrato de gestão (só por NÃO participar; nunca por discordar).
    function _penalizarFaltas(uint256 id, uint32 rodada) private {
        for (uint8 k = 0; k < 2; k++) {
            address[] storage lista = k == 0 ? jurados[id][rodada] : observadores[id][rodada];
            for (uint256 i = 0; i < lista.length; i++) {
                if (votos[id][rodada][lista[i]] == Veredito.Nenhum) {
                    emit FaltaDeParticipacao(id, rodada, lista[i]);
                    _avisarGestao(abi.encodeCall(IGestao.registrarFalta, (lista[i])));
                }
            }
        }
    }

    /// Pode participar desta rodada? (júri sorteado, ou o modo antigo)
    function _participa(uint256 id, Registro storage r, address quem) private view returns (bool) {
        if (juri[id][r.rodada].tamanho > 0) return papel[id][r.rodada][quem] != 0;
        return _podeVotar(r, quem);
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
