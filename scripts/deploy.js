const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [conta] = await hre.ethers.getSigners();
  console.log("Publicando com a conta:", conta.address);

  const saldo = await hre.ethers.provider.getBalance(conta.address);
  console.log("Saldo:", hre.ethers.formatEther(saldo), "ETH");

  const oathChain = await hre.ethers.deployContract("OathChain");
  await oathChain.waitForDeployment();

  const endereco = await oathChain.getAddress();
  console.log("OathChain publicado em:", endereco);
  console.log("Ver no explorador: https://sepolia.etherscan.io/address/" + endereco);

  // Guarda o endereço em deployments/<rede>.json (é público, pode ir para o GitHub)
  const pasta = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, hre.network.name + ".json");
  fs.writeFileSync(
    arquivo,
    JSON.stringify(
      { OathChain: endereco, rede: hre.network.name, publicadoEm: new Date().toISOString() },
      null,
      2
    )
  );
  console.log("Endereço salvo em:", arquivo);
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
