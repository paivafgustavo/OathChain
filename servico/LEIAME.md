# Serviço de verificação por IA do OathChain (100% gratuito)

Um **filtro de fato vs. opinião** + 4 agentes (Pesquisador, Avaliador de fontes, Analista especialista e Contraditor) + um Relator em código.
O resultado vai para o contrato como veredito **provisório**; humanos podem recorrer.

## Como rodar
1. `npm install`
2. Copie `.env.exemplo` para `.env` e preencha (pelo menos UMA chave: Groq ou Gemini).
3. Teste sem blockchain: `npm run verificar -- --texto "O PIB do Brasil cresceu 3% em 2024" --assunto Economia --ref 2024`
4. Crie uma carteira NOVA só para o serviço (só ETH de teste!) e ponha a chave dela em `PRIVATE_KEY_AGENTE` aqui.
   Autorize o endereço público dela no contrato: na raiz do projeto, `AGENTE_VERIFICADOR=0x...` no `.env` e
   `npx hardhat run scripts/autorizar-agente.js --network sepolia` (com a conta dona do contrato).
5. `npm run diagnostico`: confere `.env`, endereço do contrato, autorização do agente, saldo e a fila (não mostra chaves).
6. `npm start`: o serviço procura afirmações novas a cada 30 s e registra o veredito.
7. `npm test`: 29 testes automáticos com servidores falsos (não gasta cota de nenhuma API).

Sem nenhuma chave, roda em **modo demonstração** (respostas simuladas, o relatório diz `"simulado": true`).

## Filtro fato vs. opinião (`src/filtro.js`)
Opinião ("o melhor governo da história"), gosto ou previsão não podem ser checados com fontes. Antes de chamar
os agentes, regras fixas procuram sinais (primeira pessoa, juízo de valor, verbo no futuro) e âncoras de fato
(números, datas, órgãos, verbos de medição). Opinião sem fato vai ao júri como **Inconclusiva (0%)**, com o
motivo no relatório, sem gastar cota. Casos duvidosos são perguntados a um modelo; **na dúvida, verifica**
(barrar um fato verificável é pior do que deixar a IA responder "Inconclusiva").

## Teste de acurácia (`npm run acuracia`)
Roda o pipeline contra `dados/acuracia.json` (afirmações com veredito já conhecido) e mostra:
- **precisão quando a IA decide sozinha** (confiança ≥ 70): o número mais importante, porque é o que vira provisório;
- cobertura (quantas a IA decide sem o júri), erros graves (Verdadeira ↔ Falsa) e opiniões detectadas.

Os itens iniciais são fatos públicos com fonte oficial, **não checados por agências**. Para o teste valer,
acrescente checagens da Lupa, Aos Fatos, Comprova ou Estadão Verifica (campos `agencia` e `link`).
Use `--max 5` para poupar cota e `--continuar` para completar a base em vários dias (mantém o que já foi medido; para sozinho após 2 falhas seguidas por cota). O detalhe fica em `acuracia-resultado.json`.

## IPFS (opcional)
Com `PINATA_JWT`, o relatório (texto exato) também é publicado no IPFS e a blockchain guarda `ipfs://CID`.
O site tenta vários gateways públicos e confere o hash: um gateway que altere o texto é pego na hora.
Se a Pinata falhar, o serviço usa a própria URL (`URL_PUBLICA`) e segue.

## Garantias
- O relatório é um arquivo de texto; o hash (keccak256) desse texto fica na blockchain. Quem baixar confere.
- Texto vindo da web é tratado como dado, nunca como instrução (marcadores + aviso no prompt).
- Resposta inválida da IA vira "Inconclusiva". Confiança tem tetos (poucas fontes, fontes fracas, contraditor discorda).
- Limite diário (`LIMITE_DIARIO`) protege as cotas gratuitas.
