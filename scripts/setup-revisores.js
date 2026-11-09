const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

// Endereços públicos dos revisores de teste
const REVISORES = [
  { nome: "Revisor 1", endereco: "0x94B209d982392d0Cf2a0C3c2026D7021937C1C5C" },
  { nome: "Revisor 2", endereco: "0x8F4ecabD57829c2c49AC96FC40101018C4651268" },
  { nome: "Revisor 3", endereco: "0xd5dCBf4BD2EB502Fdb4Ef37eAA33A151E55A0172" },
];

// O endereço do contrato vem do .env (CONTRACT_ADDRESS) ou de deployments/<rede>.json
function lerEnderecoDoContrato() {
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS;
  const arquivo = path.join(__dirname, "..", "deployments", hre.network.name + ".json");
  if (fs.existsSync(arquivo)) {
    return JSON.parse(fs.readFileSync(arquivo, "utf8")).OathChain;
  }
  throw new Error(
    "Endereço do contrato não encontrado. Coloque CONTRACT_ADDRESS=0x... no arquivo .env"
  );
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
    if (await oathChain.ehRevisor(addr)) {
      console.log(r.nome, "já estava cadastrado, pulando.");
      continue;
    }
    const tx = await oathChain.definirRevisor(addr, true);
    await tx.wait();
    console.log(r.nome, "cadastrado:", addr);
  }

  const ativos = await oathChain.revisoresAtivos();
  console.log("Revisores ativos no contrato:", ativos.toString());
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
