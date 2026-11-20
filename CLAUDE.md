# OathChain: guia para o Claude Code

Leia este arquivo antes de qualquer tarefa. Ele resume o projeto, as decisões já tomadas, os comandos e o que falta.

## Quem é o usuário e como trabalhar com ele
- Gustavo, 2º semestre de Ciência da Computação na UFG. Está aprendendo; explique o "porquê" de forma simples.
- **Responda sempre em português.**
- **Depois de cada ação, mostre o roadmap em checklist (feito / a fazer).** É um pedido permanente dele.
- Prefere receber arquivos prontos e o passo a passo exato dos comandos (ele usa Windows/PowerShell).
- Nunca peça nem imprima chaves privadas. Nunca coloque o `.env` no Git.

## O projeto
OathChain é um livro-razão público (rede de testes **Sepolia**) de afirmações e promessas verificadas. É a entrega do bloco 5 do curso de blockchain da LetsCocreate (prazo curto, ~3 semanas desde o início; confirmar a data exata e se é individual ou em grupo).

### Decisões de design (não reverter sem conversar com o Gustavo)
1. **Verificação híbrida:** 4 agentes de IA gratuitos dão um veredito **provisório**; humanos só entram por recurso, em um **júri sorteado**.
2. **Sem porteiro único** para virar revisor: candidatura com depósito + período de prova (aprendiz → revisor).
3. **Aprendizes não são obrigados a votar com a maioria** ("maria vai com as outras" é o que se quer evitar). Multa só por **não participar**, nunca por discordar.
4. **Voto aberto com justificativa junto** (decidido em 18/11): `votarComJustificativa(id, veredito, justificativa >= 40 caracteres, linkFonte http)` numa única transação, durante toda a janela. O modo secreto (commit-reveal: `comprometerVoto` / `revelarVoto`) continua no contrato, desligado por padrão (`votoSecreto = false`); liga com `definirJuri(tamanho, aprendizes, true)`.
5. Maioria = **mais de 50% do tamanho do júri** (ex.: 3 de 5). Aprendizes observam: o voto é registrado mas não conta no resultado.
6. `finalizar` libera antes do prazo quando **todos os sorteados** (jurados + aprendizes) já votaram.

## Estrutura (raiz do repositório = pasta `OathChain`)
```
contracts/OathChain.sol          contrato principal (v5)
contracts/GestaoRevisores.sol    candidatura, depósito, prova, faltas
test/OathChain.test.js           53 testes
test/Juri.test.js                30 testes (júri, voto aberto, voto secreto, candidatura)
scripts/deploy.js                publica os 2 contratos, liga um ao outro, grava deployments/<rede>.json e frontend/src/deployment.json
scripts/setup-revisores.js       cadastra 5 revisores de TESTE (atalho; em produção a entrada é por candidatura)
scripts/janelas.js               muda as 3 janelas ($env:DEMO=1 = 1200/300/300 s; sem DEMO = 604800/604800/259200 s)
scripts/autorizar-agente.js      autoriza AGENTE_VERIFICADOR (.env da raiz) no contrato já publicado
frontend/                        React 18 + Vite + ethers v6 (rotas por hash: #rota/param)
servico/                         serviço de IA (Node): Firecrawl + Groq/Gemini/OpenRouter; grava o veredito provisório
hardhat.config.js                Solidity 0.8.24, viaIR, optimizer runs 50
```

## Comandos
Na raiz (contratos):
```powershell
npx hardhat clean
npx hardhat test                                         # esperado: 86 passing
npx hardhat run scripts/deploy.js --network sepolia      # novo deploy
$env:DEMO=1; npx hardhat run scripts/deploy.js --network sepolia   # deploy com prazos curtos (Remove-Item Env:DEMO para voltar)
npx hardhat run scripts/setup-revisores.js --network sepolia
npx hardhat run scripts/janelas.js --network sepolia
```
Site: `cd frontend; npm install; npm run dev` (local) / `npm run build` (saída em `dist`).
Serviço de IA: `cd servico; npm install; npm start` (servidor + processamento) | `npm test` (31 testes) | `npm run diagnostico` | `npm run acuracia -- --max 5` | `npm run verificar -- --texto "..." --assunto Meio_Ambiente --ref 2024` (CLI de teste).

## Estado atual (20/11/2026)
- **Publicado:** site https://oath-chain.vercel.app (Vercel, root `frontend`), serviço de IA no Render (`render.yaml`, relatórios no IPFS via Pinata, UptimeRobot em /saude). Ciclo completo em produção validado no registro #4. Rodar o serviço local junto com o Render duplica o trabalho: não fazer.
- **Contratos v6 na Sepolia (20/11/2026, verificados no Etherscan):** OathChain `0x3724764C87984e4245794985E9e81aC232C513e6`, GestaoRevisores `0xbeA950a0b9575e0944D8a945a9f18b00abd1c98B` (bloco 12177989). Revisores de teste cadastrados, agente autorizado, Render e Vercel apontando para a v6. A v5 (`0xd9C6EAFE90B59B2e6a6ca9B780A1f2E5Ae34A2D2`) ficou como histórico dos testes de produção (registros 1 a 4).
- Revisores de teste cadastrados com `setup-revisores.js` (conferir se os 5 passaram; o RPC caiu uma vez no meio).
- Um registro foi enviado e estava em "Aguardando os 4 agentes de IA": o serviço de IA precisa (a) estar rodando, (b) ter `CONTRACT_ADDRESS` apontando para o contrato novo, (c) usar uma carteira (`PRIVATE_KEY_AGENTE`) **autorizada no contrato** com `definirAgenteVerificador(endereco)` e com ETH de teste. Se o deploy não usou `AGENTE_VERIFICADOR`, o agente ainda não foi autorizado: verificar isso primeiro.
- Tudo foi testado localmente (83 testes de contrato, 11 do serviço, e2e do site). **Ainda não testado em ambiente real:** IA com chaves reais (Groq/Gemini/Firecrawl), hospedagem na Vercel e o ciclo completo na Sepolia com o contrato novo.

## Arquitetura resumida
- **Fluxo:** registrar (`registrarAfirmacao`/`registrarPromessa`) → IA (`registrarVerificacaoIA`: confiança ≥ `limiteConfianca` 70 e não Inconclusiva → estado Provisória com janela de recurso de 3 dias; senão vai ao júri) → recurso (`recorrerDaIA`, não conta como contestação) ou `confirmarIA` → júri sorteado (`sortearJurados` com o `blockhash` de `block.number+3`, Fisher-Yates parcial, autor excluído, quem julgou a rodada anterior é evitado; renova se passar de 256 blocos) → voto → `finalizar` → janela de contestação de 7 dias (máx. 3 rodadas, o autor contesta 1 vez).
- Configuração do júri e do voto é "fotografada" ao abrir a rodada (`Juri`): mudar parâmetros depois não afeta rodadas em andamento.
- Faltas: no `finalizar`, quem foi sorteado e não votou leva falta (chamada de baixo nível ao contrato de gestão, nunca trava a votação).
- GestaoRevisores: `candidatar` (depósito 0,01 ETH) → Aprendiz → `promover` (mín. 5 votos, ≤ 2 faltas, 7 dias de prova, teto de crescimento) → Revisor; `rebaixar`, `sair`/`sacar`.
- Serviço de IA: 4 agentes (debate), provas de Google Fact Check, Wikipedia, Firecrawl (1.000 créditos/mês grátis) e DuckDuckGo de reserva; defesas contra prompt injection e SSRF (`urlSegura`); limites por dia/IP; relatório com hash keccak256 do texto exato, guardado na blockchain.
- Site: o "sal" do voto secreto vem de `signer.signMessage` (determinístico); `d.agora` usa o relógio do navegador.

## Armadilhas já encontradas
- **Tamanho do contrato:** limite de 24.576 bytes; hoje ~23,3 KB com `viaIR` + `runs: 50`. Qualquer função nova pode estourar: conferir após mudar.
- **Alchemy + conta com delegação (EIP-7702):** erro `in-flight transaction limit reached for delegated accounts`. Os scripts já esperam e tentam de novo; a solução definitiva é usar uma conta comum para deploy/administração.
- **RPC cai** (`other side closed`): os scripts tentam de novo, conferindo antes se a transação já passou.
- **Groq:** `llama-3.3-70b-versatile` foi desativado em 16/08/2026; o padrão agora é `openai/gpt-oss-120b`. Modelos configuráveis no `.env` (`GROQ_MODEL`, `GEMINI_MODEL`). Gemini às vezes dá 503 e timeout.
- Mudou o contrato → **novo endereço**: atualizar `servico/.env`, rodar `setup-revisores.js` de novo, autorizar o agente e dar push no `deployment.json`.
- Prazos de uma rodada ficam fixos desde o sorteio: para demo, rode `janelas.js` **antes** de registrar.

## O que falta (roadmap)
**Feito:** contratos v5 (83 testes), júri sorteado, voto aberto com justificativa, finalização antecipada, candidatura de revisores, IA híbrida, serviço de IA, site com landing/logo, README, deploy na Sepolia.
**Feito em 19/11:** corrigido o `npm start` que não rodava no Windows (comparação de `import.meta.url`); filtro fato vs. opinião (`servico/src/filtro.js`); `npm run acuracia` + `servico/dados/acuracia.json`; IPFS opcional dos relatórios via Pinata (`PINATA_JWT`, URL `ipfs://CID`, site tenta 3 gateways); `npm run diagnostico`; `scripts/autorizar-agente.js`; `janelas.js` com `DEMO=1` e janela de recurso da IA; `docs/ROTEIRO-DEMO.md`; LICENSE. Testes do serviço: 21 (eles agora zeram as chaves reais do `.env`, que antes faziam o teste chamar APIs de verdade e travar).
**20/11:** créditos grátis do Firecrawl ESGOTARAM (402) no meio da acurácia: sem busca na web, notícias recentes viram Inconclusiva (também em produção no Render). Adicionada a Tavily (`TAVILY_API_KEY`, `buscarTavily` em busca.js) como segunda busca, mas o Gustavo DECIDIU não criar a chave (fica opcional, sem uso); a acurácia exclui itens sem fonte da web por falta de crédito (`semBuscaWeb`). Base de acurácia: 26 itens (11 notícias reais com `"real": true`). Resultado parcial das reais: precisão automática 100%, cobertura só 11% (1 de 9), 0 erros graves.
**Diagnóstico de 19/11:** IA destravada (agente autorizado, 1º veredito real no registro 2: Verdadeira 36% → júri). Corrigida a corrida entre ciclos do serviço (trava + reconferência do estado). O serviço agora chama `finalizar` (todos votaram ou prazo acabou) e `confirmarIA` (janela de recurso acabou) sozinho (`finalizarProntos`, com `staticCall` antes). Atenção: `confirmarIA` grava `fimContestacao = agora`, então veredito da IA confirmado NÃO tem janela de contestação (só o caminho do júri tem). Sem o serviço rodando, o botão "Finalizar votação" do site continua funcionando. Testes do serviço: 29. `npm run acuracia -- --continuar` completa a base em vários dias (cota diária do Gemini acaba em ~5 afirmações). Bug corrigido: modelos devolviam confiança em 0..1 (0.95 virava 1%); agora `normalizarConfianca` e sinônimos de veredito. Groq gpt-oss com `reasoning_effort: low` (GROQ_REASONING). Falha só da réplica não invalida a análise (`agenteSemResposta`). Cota de IA: 429 por minuto agora espera e tenta de novo; sem resposta da IA o serviço NÃO grava nada e pausa 10 min; prompts limitados a 8 fontes × 800 caracteres; a acurácia exclui itens com falha de IA (pausa padrão 20 s).

**A fazer:**
- [ ] Destravar a verificação da IA: preencher `PRIVATE_KEY_AGENTE`, rodar `scripts/autorizar-agente.js`, `npm run diagnostico`, `npm start`
- [ ] Testar o ciclo completo na Sepolia (IA, júri, votar, finalizar)
- [x] Acurácia completa em 20/11: 15/15 medidas, precisão automática 100% (10/10), 0 erros graves, cobertura 83%, filtro 3/3 (RELATORIO seção 6 e README atualizados)
- [ ] Quando os créditos do Firecrawl renovarem (mensal): `npm run acuracia -- --continuar` para os 6 itens reais sem busca e atualizar RELATORIO seção 6 ("Notícias reais (parcial)")
- [ ] Acrescentar afirmações checadas por agências (Lupa, Aos Fatos, Comprova) em `servico/dados/acuracia.json`
- [ ] Hospedar o serviço no Render (`render.yaml` pronto; passo a passo em `docs/HOSPEDAGEM.md`; precisa de PINATA_JWT porque o disco do Render é apagado; UptimeRobot em /saude para não dormir; o serviço lê PORT)
- [ ] Publicar o site na Vercel (passo a passo em `docs/HOSPEDAGEM.md`)
- [ ] Verificar os contratos no Etherscan: `ETHERSCAN_API_KEY` no .env da raiz + `npx hardhat run scripts/verificar.js --network sepolia` (bytecode local já conferido: idêntico ao publicado)
- [ ] IPFS também para o texto dos registros (precisa de upload pelo serviço; hoje o texto fica no contrato)
- [ ] Gravar o vídeo (roteiro em `docs/ROTEIRO-DEMO.md`)
- [x] Relatório final em `docs/RELATORIO.md` (atualizar a seção 6 quando a acurácia estiver completa)
- [x] Decidido manter `definirRevisor` (documentado como porta de teste)
- [ ] Conferir o enunciado oficial do bloco 5 (individual ou em grupo, prazo)
- [x] v6 (20/11): o contrato exige revisor para registrar (`_criar`); no modo "todos votam" o autor sai da conta da maioria. Decidido MANTER `definirRevisor` e o texto no contrato (não no IPFS).
- [ ] Decidir se a finalização antecipada espera só os jurados (sem os aprendizes)

## Primeira tarefa sugerida ao abrir o Claude Code
"Leia o CLAUDE.md. Confira se os 83 testes passam, depois me ajude a destravar a verificação da IA (serviço de IA com o contrato novo e agente autorizado)."
