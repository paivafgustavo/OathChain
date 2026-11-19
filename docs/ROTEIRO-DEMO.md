# Roteiro da demonstração (vídeo de ~5 minutos)

Objetivo do vídeo: mostrar o ciclo completo de uma afirmação na Sepolia (registro → IA → recurso → júri → veredito definitivo) e provar que nada pode ser apagado.

## Antes de gravar (preparação, ~30 min)

1. **Prazos curtos** (vale só para rodadas novas, por isso faça ANTES de registrar):
   ```powershell
   $env:DEMO=1; npx hardhat run scripts/janelas.js --network sepolia; Remove-Item Env:DEMO
   ```
   Votação 20 min, contestação 5 min, recurso da IA 5 min.
2. **Serviço de IA funcionando:**
   ```powershell
   cd servico
   npm run diagnostico      # tudo ✅?
   npm start                # deixe esta janela aberta durante a gravação
   ```
3. **MetaMask com as carteiras de teste:** a do autor e pelo menos 3 revisores (as de `setup-revisores.js`), todas com um pouco de ETH de teste.
4. **Duas afirmações prontas para copiar** (uma para cada caminho):
   - Fato claro, para a IA decidir sozinha: *"O Censo 2022 do IBGE contou cerca de 203 milhões de habitantes no Brasil."* (período 2022)
   - Opinião, para mostrar o filtro: *"Eu acho que este é o melhor governo da história do país."*
5. Abra o Etherscan do contrato numa aba (o link fica no rodapé do site).

## Gravação

| Tempo | Tela | O que mostrar e falar |
|---|---|---|
| 0:00 | Página inicial | O problema: promessas e afirmações públicas somem ou são reescritas. O OathChain grava na blockchain com data, autor e histórico. |
| 0:30 | **Registrar** | Registra a afirmação do Censo com a carteira do autor. Mostra a MetaMask assinando: quem registrou fica gravado. |
| 1:00 | Registro → painel 🤖 | "Aguardando os 4 agentes". Muda para o terminal do serviço: o filtro diz que é um fato e os agentes buscam fontes, avaliam, analisam e contestam. |
| 1:45 | Painel 🤖 | Veredito **provisório** com a confiança. Clica em ver o relatório: aparece **"✔ Relatório íntegro"** (o hash do texto bate com o da blockchain). Mostra as fontes e como cada agente votou. |
| 2:30 | Painel 🤖 | Troca para uma carteira de revisor e clica em **Recorrer**: humanos sempre podem contestar a IA. |
| 2:50 | Painel do júri | **Sortear jurados**: o sorteio usa o hash de um bloco futuro, então ninguém escolhe quem julga. |
| 3:10 | Painel do júri | Com 2 ou 3 jurados sorteados, **vota com justificativa e link da fonte**. Mostra a contagem subindo. |
| 3:50 | Registro | **Finalizar votação** (libera antes do prazo quando todos os sorteados votaram). Estado: Verificada, com janela de contestação. |
| 4:15 | Registro (2ª aba) | Registra a opinião: o painel mostra que o **filtro de fato vs. opinião** a mandou direto ao júri, sem gastar IA. |
| 4:35 | Etherscan | Os eventos (`RegistroCriado`, `VerificacaoIARegistrada`, `RecursoDaIA`, `JuradosSorteados`, `VotoRegistrado`, `Finalizado`) estão lá para qualquer pessoa auditar. Nada foi apagado. |
| 4:50 | Página inicial | Fechamento: limitações (júri pequeno na testnet, IA pode errar, por isso existe o recurso) e próximos passos. |

## Depois de gravar

Volte os prazos ao normal:
```powershell
npx hardhat run scripts/janelas.js --network sepolia
```

## Se algo der errado ao vivo

- **IA não responde:** `npm run diagnostico` no `servico`. Os motivos mais comuns são carteira do agente sem autorização (`scripts/autorizar-agente.js`) ou sem ETH.
- **"in-flight transaction limit" na Alchemy:** espere 15 s; os scripts já tentam de novo.
- **Relatório não abre no site:** com `URL_PUBLICA=localhost`, só abre neste computador. Para abrir em qualquer lugar, use `PINATA_JWT` (IPFS).
- **Janela não fecha:** os prazos de uma rodada ficam fixos desde o sorteio; rodadas abertas antes do `janelas.js` usam os prazos antigos.
