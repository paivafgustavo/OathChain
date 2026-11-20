# Colocar o OathChain no ar (tudo grátis)

Ao final, você terá:
- o **site** na Vercel (`https://oathchain.vercel.app` ou parecido), aberto para qualquer pessoa;
- o **serviço de IA** no Render, funcionando sem o seu computador ligado;
- os **relatórios da IA** no IPFS, sem depender de nenhum servidor;
- o **código dos contratos** verificado no Etherscan.

Faça na ordem. Nenhum passo pede cartão de crédito.

---

## 1. IPFS (Pinata): 5 min

No plano grátis, o disco do Render é apagado a cada reinício. Sem IPFS, os relatórios sumiriam.

1. Crie uma conta em <https://app.pinata.cloud>.
2. **API Keys → New Key**, marque **pinFileToIPFS** e crie. Copie o **JWT** (aparece uma vez só).
3. Teste no seu computador: ponha `PINATA_JWT=...` no `servico/.env` e rode `npm run diagnostico`. Deve aparecer "✅ PINATA_JWT preenchido".

## 2. Serviço de IA (Render): 15 min

1. Crie uma conta em <https://render.com> entrando com o GitHub.
2. **New → Blueprint**, escolha o repositório `OathChain`. O Render lê o `render.yaml` da raiz.
3. Ele pede as chaves marcadas como secretas. Copie os mesmos valores do seu `servico/.env`:
   `GROQ_API_KEY`, `GEMINI_API_KEY`, `FIRECRAWL_API_KEY`, `PINATA_JWT`, `RPC_URL`, `PRIVATE_KEY_AGENTE`.
   Opcional: `TAVILY_API_KEY` (grátis em <https://app.tavily.com>), uma segunda busca na web para quando os 1.000 créditos mensais do Firecrawl acabarem. Se quiser usar, adicione em Environment.
   Deixe vazias as que você não usa (`OPENROUTER_API_KEY`, `FACTCHECK_API_KEY`).
4. Em `URL_PUBLICA`, por enquanto ponha `https://oathchain-ia.onrender.com`. Depois do primeiro deploy, confira o endereço real no topo da página do serviço e corrija se for diferente.
5. **Apply**. Quando terminar, abra `https://SEU-ENDERECO.onrender.com/saude`. Deve aparecer `{"ok":true,"demo":false,"iaConfigurada":true}`.
6. **Desligue o `npm start` do seu computador.** Dois serviços ao mesmo tempo verificariam as mesmas afirmações em dobro.

> As chaves ficam guardadas no painel do Render, nunca no GitHub. O `render.yaml` só tem os **nomes** delas.

### Impedir o serviço de "dormir"

No plano grátis, o Render desliga o serviço depois de 15 minutos sem receber acessos. Desligado, ele para de procurar afirmações novas. Para evitar isso:

1. Crie uma conta em <https://uptimerobot.com>.
2. **Add New Monitor → HTTP(s)**, URL `https://SEU-ENDERECO.onrender.com/saude`, intervalo de **5 minutos**.

O acesso a cada 5 minutos mantém o serviço acordado. As 750 horas grátis por mês do Render bastam para 1 serviço ligado o tempo todo.

## 3. Site (Vercel): 10 min

1. Crie uma conta em <https://vercel.com> entrando com o GitHub.
2. **Add New → Project**, importe o `OathChain`.
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite (aparece sozinho)
   - **Build Command:** `npm run build`. **Output Directory:** `dist`
4. **Deploy**. Cada `git push` publica de novo, sozinho.

O site lê os endereços dos contratos de `frontend/src/deployment.json`. Se você fizer um novo deploy dos contratos, dê `git push` desse arquivo.

## 4. Verificar os contratos no Etherscan: 5 min

1. Crie uma conta em <https://etherscan.io> → **API Keys → Add**. A mesma chave vale para a Sepolia.
2. No `.env` da **raiz** do projeto: `ETHERSCAN_API_KEY=...`
3. Na raiz:
   ```powershell
   npx hardhat run scripts/verificar.js --network sepolia
   ```
   Não gasta ETH. No Etherscan, a aba **Contract** passa a mostrar o código com o selo "Verified", e qualquer pessoa pode ler o contrato e chamar as funções por ali.

## Conferência final

- [ ] `https://SEU-ENDERECO.onrender.com/saude` responde `"ok":true`
- [ ] Registrar uma afirmação no site da Vercel → em até 1 minuto aparece o veredito da IA
- [ ] O relatório abre com "✔ Relatório íntegro" e o link começa com `ipfs://`
- [ ] O Etherscan mostra os 2 contratos como verificados
- [ ] O UptimeRobot mostra o monitor como "Up"
