# Serviço de verificação por IA do OathChain (100% gratuito)

4 agentes (Pesquisador, Avaliador de fontes, Analista especialista e Contraditor) + um Relator em código.
O resultado vai para o contrato como veredito **provisório**; humanos podem recorrer.

## Como rodar
1. `npm install`
2. Copie `.env.exemplo` para `.env` e preencha (pelo menos UMA chave: Groq ou Gemini).
3. Teste sem blockchain: `node src/cli.js --texto "O PIB do Brasil cresceu 3% em 2024" --assunto Economia --ref 2024`
4. Crie uma carteira NOVA só para o serviço, ponha o endereço em `AGENTE_VERIFICADOR` no `.env` do projeto principal
   (ou chame `definirAgenteVerificador`) e a chave dela em `PRIVATE_KEY_AGENTE` aqui. Só ETH de teste!
5. `npm start`: o serviço procura afirmações novas a cada 30 s e registra o veredito.
6. `npm test`: 11 testes automáticos com servidores falsos (não gasta cota de nenhuma API).

Sem nenhuma chave, roda em **modo demonstração** (respostas simuladas, o relatório diz `"simulado": true`).

## Garantias
- O relatório é um arquivo de texto; o hash (keccak256) desse texto fica na blockchain. Quem baixar confere.
- Texto vindo da web é tratado como dado, nunca como instrução (marcadores + aviso no prompt).
- Resposta inválida da IA vira "Inconclusiva". Confiança tem tetos (poucas fontes, fontes fracas, contraditor discorda).
- Limite diário (`LIMITE_DIARIO`) protege as cotas gratuitas.
