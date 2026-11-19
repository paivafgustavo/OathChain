// Autoriza a carteira do serviço de IA no contrato JÁ publicado (sem precisar de novo deploy).
// 1) No .env da RAIZ do projeto, ponha o ENDEREÇO PÚBLICO da carteira do agente: AGENTE_VERIFICADOR=0x...
// 2) npx hardhat run scripts/autorizar-agente.js --network sepolia   (com a conta DONA do contrato)
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
async function tentar(fn) {
  for (let i = 0; i < 12; i++) {
    try { return await fn(); } catch (e) {
      if (!/in-flight|replacement transaction|nonce too low|other side closed|socket|ECONNRESET|ETIMEDOUT|fetch failed|timeout|429|502|503|504/i.test(String(e.message) + String(e.code || ""))) throw e;
      console.log("Rede ocupada, tentando de novo em 15 s... (" + (i + 1) + ")");
      await dormir(15000);
    }
  }
  throw new Error("A rede não liberou a transação. Tente de novo em alguns minutos.");
}

async function main() {
  const arquivo = path.join(__dirname, "..", "deployments", hre.network.name + ".json");
  const endereco = fs.existsSync(arquivo) ? JSON.parse(fs.readFileSync(arquivo, "utf8")).OathChain : process.env.CONTRACT_ADDRESS;
  if (!endereco) throw new Error("Endereço do contrato não encontrado. Rode o deploy.js primeiro.");
  if (!process.env.AGENTE_VERIFICADOR) throw new Error("Ponha AGENTE_VERIFICADOR=0x... (endereço PÚBLICO da carteira do serviço) no .env da raiz.");
  const agente = hre.ethers.getAddress(process.env.AGENTE_VERIFICADOR); // confere se é um endereço válido

  const [conta] = await hre.ethers.getSigners();
  const oathChain = await hre.ethers.getContractAt("OathChain", endereco);
  if ((await oathChain.owner()).toLowerCase() !== conta.address.toLowerCase()) throw new Error("Esta conta não é a dona do contrato.");

  const atual = await oathChain.agenteVerificador();
  console.log("Contrato:", endereco);
  console.log("Agente autorizado hoje:", atual);
  // confere de novo a cada tentativa: se a rede caiu depois de a transação passar, não reenvia
  await tentar(async () => {
    if ((await oathChain.agenteVerificador()).toLowerCase() === agente.toLowerCase()) return;
    await (await oathChain.definirAgenteVerificador(agente)).wait();
  });
  console.log("Agente autorizado agora:", await oathChain.agenteVerificador());
  const saldo = await hre.ethers.provider.getBalance(agente);
  console.log("Saldo da carteira do agente:", hre.ethers.formatEther(saldo), "ETH", saldo < hre.ethers.parseEther("0.005") ? "(baixo: mande ETH de teste para ela)" : "");
}

main().catch((erro) => {
  console.error(erro.message || erro);
  process.exitCode = 1;
});
