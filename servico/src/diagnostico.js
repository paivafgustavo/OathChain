// Uso: npm run diagnostico
// Confere, sem mostrar nenhuma chave, tudo o que impede o serviço de gravar o veredito da IA.
import fs from "node:fs";
import { ethers } from "ethers";
import { config, modoDemo } from "./config.js";
import { conectar } from "./chain.js";

const ok = (m) => console.log("  ✅ " + m);
const ruim = (m) => { console.log("  ❌ " + m); problemas += 1; };
const aviso = (m) => console.log("  ⚠️  " + m);
let problemas = 0;

console.log("\n1) Arquivo .env (só confere se está preenchido, nunca mostra o valor)");
for (const [nome, valor] of [["RPC_URL", config.rpcUrl], ["CONTRACT_ADDRESS", config.contrato], ["PRIVATE_KEY_AGENTE", config.chaveAgente]]) {
  valor ? ok(`${nome} preenchido`) : ruim(`${nome} vazio`);
}
const ias = [["GROQ_API_KEY", config.groqKey], ["GEMINI_API_KEY", config.geminiKey], ["OPENROUTER_API_KEY", config.openrouterKey]].filter(([, v]) => v).map(([n]) => n);
ias.length ? ok("chaves de IA: " + ias.join(", ")) : aviso("nenhuma chave de IA: o serviço vai rodar em MODO DEMONSTRAÇÃO (vereditos simulados)");
config.firecrawlKey ? ok("FIRECRAWL_API_KEY preenchido") : aviso("sem FIRECRAWL_API_KEY: menos fontes (só Wikipédia, Fact Check e DuckDuckGo)");
config.pinataJwt ? ok("PINATA_JWT preenchido: relatórios vão para o IPFS") : aviso("sem PINATA_JWT: relatórios ficam só neste computador (URL_PUBLICA)");
if (/localhost|127\.0\.0\.1/.test(config.urlPublica) && !config.pinataJwt) aviso("URL_PUBLICA é localhost: só quem está neste computador consegue abrir o relatório no site");

console.log("\n2) Endereço do contrato");
try {
  const dep = JSON.parse(fs.readFileSync(new URL("../../deployments/sepolia.json", import.meta.url), "utf8"));
  if (config.contrato && dep.OathChain.toLowerCase() === config.contrato.toLowerCase()) ok("CONTRACT_ADDRESS é o mesmo do último deploy (" + dep.OathChain + ")");
  else ruim(`CONTRACT_ADDRESS (${config.contrato || "vazio"}) é diferente do último deploy (${dep.OathChain}). Troque no servico/.env`);
} catch { aviso("não achei deployments/sepolia.json para comparar"); }

if (problemas) { console.log(`\n${problemas} problema(s) acima. Corrija o .env e rode de novo.\n`); process.exit(1); }

console.log("\n3) Blockchain");
try {
  const { provider, carteira, contrato } = conectar();
  const rede = await provider.getNetwork();
  Number(rede.chainId) === 11155111 ? ok("RPC conectado à Sepolia") : aviso("RPC conectado à rede " + rede.chainId + " (esperado: Sepolia, 11155111)");
  (await provider.getCode(config.contrato)) !== "0x" ? ok("existe um contrato nesse endereço") : ruim("não há contrato nesse endereço nessa rede");

  console.log("  Endereço público da carteira do agente: " + carteira.address);
  const autorizado = await contrato.agenteVerificador();
  if (autorizado.toLowerCase() === carteira.address.toLowerCase()) ok("a carteira está autorizada como agente verificador");
  else ruim(`o contrato autoriza ${autorizado}, não esta carteira. Na raiz do projeto, com a carteira dona do contrato, chame definirAgenteVerificador("${carteira.address}")`);

  const saldo = await provider.getBalance(carteira.address);
  saldo >= ethers.parseEther("0.005") ? ok("saldo da carteira do agente: " + ethers.formatEther(saldo) + " ETH")
    : ruim("saldo baixo na carteira do agente (" + ethers.formatEther(saldo) + " ETH). Mande ETH de teste de uma faucet Sepolia");

  const proximo = Number(await contrato.proximoId());
  const esperando = [];
  for (let id = 1; id < proximo; id++) {
    const r = await contrato.obterRegistro(id);
    if (Number(r.tipo) === 0 && Number(r.estado) === 0) esperando.push(id);
  }
  console.log(`  ${proximo - 1} registro(s) no contrato; aguardando a IA: ${esperando.length ? "#" + esperando.join(", #") : "nenhum"}`);
} catch (e) { ruim("falha ao falar com a blockchain: " + e.message); }

console.log(problemas ? `\n${problemas} problema(s). Corrija e rode de novo.\n`
  : `\nTudo certo. Rode "npm start" (${modoDemo() ? "MODO DEMONSTRAÇÃO" : "IA real"}) e deixe a janela aberta.\n`);
process.exit(problemas ? 1 : 0);
