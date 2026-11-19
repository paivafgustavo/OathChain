const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ============================================================
// Muda os prazos do contrato (em SEGUNDOS). Vale para as PRÓXIMAS rodadas.
//   Normal:        npx hardhat run scripts/janelas.js --network sepolia
//   Demonstração:  $env:DEMO=1; npx hardhat run scripts/janelas.js --network sepolia
//                  (depois: Remove-Item Env:DEMO)
// ============================================================
const PRAZOS = {
  normal: { votacao: 604800, contestacao: 604800, revisaoIA: 259200 }, // 7 dias | 7 dias | 3 dias
  demo: { votacao: 1200, contestacao: 300, revisaoIA: 300 }, //            20 min | 5 min  | 5 min
};
const modo = process.env.DEMO === "1" ? "demo" : "normal";

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

function lerEnderecoDoContrato() {
  // 1) o endereço salvo pelo deploy.js (sempre o mais recente)
  const arquivo = path.join(__dirname, "..", "deployments", hre.network.name + ".json");
  if (fs.existsSync(arquivo)) return JSON.parse(fs.readFileSync(arquivo, "utf8")).OathChain;
  // 2) senão, o CONTRACT_ADDRESS do .env
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS;
  throw new Error("Endereço do contrato não encontrado. Rode o deploy.js primeiro.");
}

async function main() {
  const endereco = hre.ethers.getAddress(lerEnderecoDoContrato());
  const [conta] = await hre.ethers.getSigners();
  const oathChain = await hre.ethers.getContractAt("OathChain", endereco);

  if ((await oathChain.owner()).toLowerCase() !== conta.address.toLowerCase()) {
    throw new Error("Esta conta não é a dona do contrato.");
  }

  const alvo = PRAZOS[modo];
  console.log(`Modo: ${modo === "demo" ? "DEMONSTRAÇÃO (prazos curtos)" : "normal"}`);
  // [nome, leitura, escrita, valor desejado]
  const janelas = [
    ["votação", "janelaVotacao", "definirJanelaVotacao", alvo.votacao],
    ["contestação", "janelaContestacao", "definirJanelaContestacao", alvo.contestacao],
    ["recurso da IA", "janelaRevisaoIA", "definirJanelaRevisaoIA", alvo.revisaoIA],
  ];
  for (const [nome, ler, escrever, valor] of janelas) {
    // confere antes de cada tentativa: se a transação já passou, não reenvia
    await tentar(async () => {
      if (Number(await oathChain[ler]()) === valor) return;
      await (await oathChain[escrever](valor)).wait();
    });
    console.log(`Janela de ${nome}: ${valor} s`);
  }
  console.log("Vale para as próximas rodadas e vereditos (os já existentes não mudam).");
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
