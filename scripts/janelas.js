const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// ============================================================
// EDITE AQUI (valores em SEGUNDOS) e rode o script.
//   Normal:        votação 604800 (7 dias)  | contestação 604800 (7 dias)
//   Demonstração:  votação 600 (10 min)     | contestação 300 (5 min)
// ============================================================
const JANELA_VOTACAO = 604800;
const JANELA_CONTESTACAO = 604800;

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

  console.log("Janela de votação atual:", (await oathChain.janelaVotacao()).toString(), "s");
  console.log("Janela de contestação atual:", (await oathChain.janelaContestacao()).toString(), "s");

  await (await oathChain.definirJanelaVotacao(JANELA_VOTACAO)).wait();
  await (await oathChain.definirJanelaContestacao(JANELA_CONTESTACAO)).wait();

  console.log("Nova janela de votação:", (await oathChain.janelaVotacao()).toString(), "s");
  console.log("Nova janela de contestação:", (await oathChain.janelaContestacao()).toString(), "s");
  console.log("Vale para as próximas rodadas e vereditos (os já existentes não mudam).");
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
