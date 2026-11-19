const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Endereços públicos dos revisores de teste
const REVISORES = [
  { nome: "Revisor 1", endereco: "0x94B209d982392d0Cf2a0C3c2026D7021937C1C5C" },
  { nome: "Revisor 2", endereco: "0x8F4ecabD57829c2c49AC96FC40101018C4651268" },
  { nome: "Revisor 3", endereco: "0xd5dCBf4BD2EB502Fdb4Ef37eAA33A151E55A0172" },
  { nome: "Revisor 4", endereco: "0xDAa415B096b11F97a63d2f1aB4dC005aa69E373E" },
  { nome: "Revisor 5", endereco: "0x9eB56B4CB42a5A66d5A2b3B6881109f97c12c76c" },
];

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// A Alchemy limita transações pendentes de contas com delegação (EIP-7702): espera e tenta de novo.
async function tentar(fn) {
  for (let i = 0; i < 12; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!/in-flight|replacement transaction|nonce too low|other side closed|socket|ECONNRESET|ETIMEDOUT|fetch failed|timeout|429|502|503|504/i.test(String(e.message) + String(e.code || ""))) throw e;
      console.log("Aguardando a transação anterior confirmar... (tentativa " + (i + 1) + ")");
      await dormir(15000);
    }
  }
  throw new Error("A rede não liberou novas transações. Tente de novo em alguns minutos.");
}

// O endereço do contrato vem do .env (CONTRACT_ADDRESS) ou de deployments/<rede>.json
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

  console.log("Contrato:", endereco);
  console.log("Conta que está enviando:", conta.address);

  const dono = await oathChain.owner();
  if (dono.toLowerCase() !== conta.address.toLowerCase()) {
    throw new Error("Esta conta não é a dona do contrato. Use a conta que publicou o OathChain.");
  }

  for (const r of REVISORES) {
    const addr = hre.ethers.getAddress(r.endereco); // confere se o endereço é válido
    // confere de novo a cada tentativa: se a rede caiu depois de a transação passar, não reenvia
    const jaEstava = await tentar(async () => {
      if (await oathChain.ehRevisor(addr)) return true;
      await (await oathChain.definirRevisor(addr, true)).wait();
      return false;
    });
    console.log(r.nome, jaEstava ? "já estava cadastrado, pulando." : "cadastrado: " + addr);
    if (!jaEstava) await dormir(5000); // folga entre transações
  }

  const ativos = await oathChain.revisoresAtivos();
  console.log("Revisores ativos no contrato:", ativos.toString());
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
