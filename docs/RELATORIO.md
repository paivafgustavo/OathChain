# OathChain: relatório final

**Projeto do bloco 5 do curso de blockchain da LetsCocreate**
Autor: Gustavo (Ciência da Computação, UFG) · Rede: Ethereum Sepolia (testnet) · Novembro de 2026

---

## 1. Resumo

O OathChain é um livro-razão público de **afirmações** (declarações sobre fatos, ligadas a um período) e **promessas** (compromissos com prazo e critérios mensuráveis). Cada registro fica gravado na blockchain com autor, data e histórico completo, e recebe um veredito (Verdadeira, Falsa ou Inconclusiva; para promessas, Cumprida ou Não cumprida).

A verificação é **híbrida**:
1. um filtro descarta opiniões e previsões, que não podem ser checadas com fontes;
2. quatro agentes de IA gratuitos pesquisam fontes e dão um veredito **provisório**, com relatório auditável;
3. humanos só entram por **recurso**, num **júri sorteado** que vota com justificativa e fonte obrigatórias.

Nada é apagado: um veredito errado é corrigido por uma nova rodada ou por um registro que **substitui** o anterior, e o antigo continua visível.

## 2. Problema

| Problema | Resposta do OathChain |
|---|---|
| Promessas públicas são esquecidas ou reescritas | Registro com data e autor que ninguém altera |
| Checagens podem ser editadas ou sumir | Cada voto, rodada e relatório fica registrado em eventos públicos |
| Promessas vagas ("vou melhorar a saúde") | Promessa exige prazo e critérios no momento do registro |
| Decisões apertadas parecem certezas | Sem maioria absoluta do júri, nenhum veredito é gravado |
| A verdade muda com o tempo | Veredito datado; correção por novo registro que "supera" o antigo |

**Por que blockchain:** um banco de dados comum pode ser alterado por quem o administra. Aqui, o registro e o histórico são imutáveis e verificáveis por qualquer pessoa, e as regras (maioria, prazos, sorteio) estão no código público do contrato, iguais para todos.

## 3. Arquitetura

| Parte | Tecnologia | Papel |
|---|---|---|
| `OathChain.sol` | Solidity 0.8.24, OpenZeppelin `Ownable` | Registros, verificação da IA, júri, votos, contestação, superação |
| `GestaoRevisores.sol` | Solidity | Candidatura com depósito, período de prova, promoção e faltas |
| Serviço de IA | Node.js, ethers v6 | Filtro, 4 agentes, relatório com hash; grava o veredito provisório e encerra votações prontas |
| Site | React 18 + Vite + ethers v6 | Consulta pública, registro, recurso, júri e candidatura via MetaMask |
| IPFS (Pinata) | opcional | Guarda o relatório da IA; a blockchain guarda `ipfs://CID` e o hash |

**Ciclo de uma afirmação:** registrar → filtro de fato/opinião → 4 agentes de IA → se a confiança for de pelo menos 70% e o veredito não for "Inconclusiva", vira **Provisória** com janela de recurso (3 dias); senão vai ao júri → recurso (opcional) → sorteio do júri com o hash de um bloco futuro → votos com justificativa (mín. 40 caracteres) e link de fonte → finalização (no prazo, ou antes se todos os sorteados votaram) → janela de contestação (7 dias, no máximo 3 rodadas) → definitivo.

**Os agentes de IA:** Pesquisador (monta as buscas), Avaliador de fontes (dá credibilidade de 0 a 100), Analista especialista (decide só com base nas fontes) e Contraditor (tenta derrubar a conclusão; o Analista responde). O **Relator não é IA**: é código com regras fixas (maioria de 2 em 3, média da confiança e tetos: menos de 2 fontes → no máximo 50; nenhuma fonte forte → no máximo 40; contraditor discorda → ×0,8). O relatório é guardado como texto exato e o seu hash keccak256 vai para a blockchain; o site baixa o relatório e confere o hash.

## 4. Governança

### Quem pode fazer o quê

| Papel | Pode | Não pode |
|---|---|---|
| Qualquer carteira | Registrar, consultar, candidatar-se a revisor, chamar `finalizar`/`promover` quando as regras permitem | Votar sem ser sorteado |
| Autor | Recorrer da IA, contestar 1 vez | Ser sorteado para julgar o próprio registro |
| Revisor | Ser sorteado, votar, recorrer, contestar | Escolher onde julga |
| Aprendiz | Ser sorteado como observador; o voto é registrado mas não conta | Decidir o resultado |
| Agente de IA (1 carteira) | Gravar o veredito provisório | Gravar veredito definitivo, votar |
| Dono dos contratos | Ajustar prazos, tamanho do júri, limite de confiança, parâmetros da candidatura; trocar a carteira da IA e o contrato de gestão; cadastrar/remover revisores à mão (`definirRevisor`) | Votar pelos outros, escolher o júri, apagar registros ou votos |

### Decisões de desenho

1. **Sem porteiro para virar revisor:** a entrada normal é a candidatura (depósito de 0,01 ETH de teste) → aprendiz → promoção automática depois de 5 votos fundamentados, no máximo 2 faltas e 7 dias, com um teto de crescimento por período. Qualquer pessoa pode chamar `promover`.
2. **Ninguém é punido por discordar:** a multa é só por **não participar** quando sorteado. Aprendizes podem votar contra a maioria sem prejuízo. Não existe métrica de "concordância com a maioria", para não incentivar o efeito manada.
3. **Voto aberto com justificativa** (padrão) numa só transação. O voto secreto (commit-reveal) existe no contrato e pode ser ligado.
4. **Maioria absoluta:** mais de 50% do tamanho do júri, e não só dos votos dados.
5. **Configuração "fotografada":** os parâmetros do júri são gravados no sorteio; mudá-los depois não afeta uma rodada em andamento.

### Pontos de centralização (honestamente)

O protótipo ainda depende de um **dono** e de **uma carteira de IA**. O caso mais sensível é `definirRevisor`: uma porta de entrada direta, mantida só para cadastrar os primeiros revisores de teste, porque sem revisores não há júri. Todos os atos do dono emitem eventos públicos e podem ser auditados no Etherscan. Numa versão real, o caminho seria:
1. remover `definirRevisor` depois do início;
2. passar a posse para uma multisig e, depois, para uma votação dos revisores;
3. permitir vários agentes de IA independentes.

## 5. Modelo de ameaças

| Ameaça | Defesa |
|---|---|
| Muitas contas falsas (sybil) | Depósito, período de prova, teto de crescimento e **sorteio**: ter muitas contas não garante uma vaga no júri |
| Autor escolhe quem julga | Sorteio com o hash de um bloco futuro (`block.number + 3`), autor excluído, quem julgou a rodada anterior é evitado |
| Jurado sorteado some | Falta registrada; multa sobre o depósito e perda do posto ao exceder o limite |
| IA errada | Veredito só provisório, tetos de confiança, contraditor obrigatório, recurso humano |
| Injeção de prompt (texto malicioso numa página) | O texto das fontes vai entre marcadores (sem os marcadores internos) e é tratado como dado; respostas da IA são saneadas (veredito fora da lista vira "Inconclusiva", confiança limitada a 0..100) |
| IA sem resposta (cota esgotada) | O serviço **não grava** nada e tenta mais tarde, em vez de gravar um "Inconclusiva 0%" que pareceria uma opinião |
| Relatório adulterado | Hash do texto exato na blockchain; o site confere o hash do que baixou, seja do serviço ou de qualquer gateway IPFS |
| SSRF no serviço | Só `http/https`, bloqueio de endereços internos e privados |
| Spam que esgota a cota da IA | Limite diário no serviço e 5 testes por hora por IP |
| Manipulação do sorteio por um validador | Possível em tese; aceitável numa testnet. Em produção: aleatoriedade verificável (VRF) |

## 6. Resultados

### Testes automatizados
- **83 testes dos contratos** (Hardhat; simulam também a passagem do tempo): regras de maioria, contestação, superação, IA, júri, voto aberto e secreto, candidatura, faltas.
- **29 testes do serviço de IA**, com servidores falsos, sem gastar cota: filtro, consolidação, saneamento, injeção de prompt, SSRF, troca de provedor, espera no limite por minuto, hash do relatório, IPFS, encerramento automático, métricas de acurácia.
- Tamanho do contrato principal: cerca de 23,3 KB, abaixo do limite de 24 KB da rede (com `viaIR` e o otimizador).

### Ciclo real na Sepolia
- Contrato: `0xd9C6EAFE90B59B2e6a6ca9B780A1f2E5Ae34A2D2`.
- Primeira verificação real: afirmação #2, avaliada pela IA como Verdadeira com 36% de confiança → abaixo do limite → foi ao júri; os 4 jurados sorteados votaram Verdadeira.
- Ciclo completo em produção (afirmação #4): registrada pelo site publicado na Vercel → verificada pelo serviço hospedado no Render (Inconclusiva, 43%), com o relatório no IPFS e o hash conferido → foi ao júri → os jurados votaram → o serviço encerrou a votação sozinho assim que todos votaram.
- Site: <https://oath-chain.vercel.app>.

### Acurácia da IA
Teste com `npm run acuracia` sobre 15 afirmações de veredito conhecido: 7 verdadeiras e 5 falsas (fatos públicos com fonte oficial, como IBGE, Constituição e OMS), mais 3 opiniões/previsões. Modelos: Groq `openai/gpt-oss-120b` e Gemini Flash, nos planos gratuitos. Por causa da cota diária, a medição foi feita em duas rodadas (19 e 20/11/2026), com o mesmo código.

| Métrica | Resultado |
|---|---|
| **Precisão quando a IA decide sozinha** (confiança ≥ 70%, o que vira veredito provisório) | **100%** (10 de 10) |
| Erros graves (Verdadeira ↔ Falsa) | **0** |
| Cobertura: fatos decididos sem precisar do júri | 83,3% (10 de 12) |
| Acerto geral nos fatos | 83,3% (os 2 restantes saíram "Inconclusiva", nenhum errado) |
| Afirmações falsas identificadas | 5 de 5 (confiança de 72% a 93%) |
| Opiniões/previsões barradas pelo filtro | 100% (3 de 3) |
| Fatos barrados por engano pelo filtro | 0 |

As duas "Inconclusivas" ("Brasília é a capital desde 1960" e "a seleção venceu a Copa 5 vezes") são verdadeiras, mas o Analista e o Contraditor julgaram que as fontes encontradas não confirmavam o fato com clareza. Elas iriam ao júri humano.

**Leitura:** a IA é conservadora. Quando as fontes não dizem algo com clareza, ela responde "Inconclusiva" e passa a decisão aos humanos, em vez de arriscar. É o comportamento desejado, porque um "não sei" custa menos que um erro com confiança alta.

**Limites do teste:**
1. A amostra é pequena (15 itens).
2. São fatos fáceis e sem controvérsia, então o resultado é um **teto otimista**.
3. Os itens não foram checados por agências.

O próximo passo é acrescentar afirmações difíceis, já checadas por Lupa, Aos Fatos ou Comprova, e acompanhar a métrica a cada mudança de modelo.

**Dois defeitos encontrados pelo próprio teste e corrigidos:**
- alguns modelos respondiam a confiança na escala de 0 a 1 (0,95 era lido como 1%);
- quando a cota acabava, uma falha virava um "Inconclusiva 0%".

## 7. Limitações

- **Entrada não é verdade:** a blockchain garante que o registro não mudou, não que ele seja verdadeiro.
- **IA gratuita:** erra, tem cota diária pequena e depende de provedores externos.
- **Júri pequeno** na testnet (4 revisores): pouca diversidade no sorteio.
- **Texto dentro do contrato:** os registros ainda guardam o texto no próprio contrato. Isso é caro numa rede principal; o caminho é guardar só o CID do IPFS.
- **Registro aberto:** o contrato aceita registro de qualquer carteira (o site mostra o botão só para revisores); o filtro e o limite diário reduzem o spam.
- **Conteúdo imutável:** um registro também pode receber conteúdo ilegal ou difamatório, que não pode ser apagado. Por isso a demonstração usa apenas afirmações fictícias ou de conhecimento público, nunca vereditos sobre pessoas reais.
- **Centralização residual:** dono e agente de IA únicos (seção 4).

## 8. Trabalhos futuros

1. Passar a governança a uma multisig e remover `definirRevisor`.
2. Texto dos registros e fontes no IPFS, com o contrato guardando só CID e hash.
3. Aleatoriedade verificável (VRF) no sorteio.
4. Base de acurácia com checagens de agências e acompanhamento contínuo.
5. Vários agentes de IA independentes, com o veredito provisório exigindo concordância entre eles.
6. Rede de camada 2, para baratear cada registro.
7. API aberta e extensão de navegador para consultar vereditos.
8. Token próprio apenas para depósito e recompensa por qualidade, nunca para comprar peso de voto.
