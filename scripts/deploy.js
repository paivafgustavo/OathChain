const hre = require("hardhat");

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
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
