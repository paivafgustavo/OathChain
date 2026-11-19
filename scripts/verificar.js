// Verifica os 2 contratos no Etherscan: o código-fonte fica público ao lado do endereço, com o selo
// "Contract Source Code Verified". Qualquer pessoa confere que o contrato na rede é exatamente este código.
//
// 1) Crie uma chave grátis em https://etherscan.io/myapikey e ponha no .env da raiz: ETHERSCAN_API_KEY=...
// 2) npx hardhat run scripts/verificar.js --network sepolia
// Não gasta ETH (é só um envio de código ao Etherscan). Pode rodar de novo sem problema.
const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function verificar(nome, endereco, args) {
  try {
    await hre.run("verify:verify", { address: endereco, constructorArguments: args });
    console.log(`✅ ${nome} verificado`);
  } catch (e) {
    const msg = String(e.message || e);
    if (/already verified/i.test(msg)) console.log(`✅ ${nome} já estava verificado`);
    else if (/bytecode.*(not|doesn't) match|does not match/i.test(msg)) {
      console.log(`❌ ${nome}: o código daqui não é igual ao publicado (o contrato mudou depois do deploy?)`);
    } else console.log(`❌ ${nome}: ${msg.split("\n")[0]}`);
  }
  console.log(`   ${EXPLORADOR}/address/${endereco}#code`);
}

const EXPLORADOR = "https://sepolia.etherscan.io";

async function main() {
  if (!process.env.ETHERSCAN_API_KEY) throw new Error("Ponha ETHERSCAN_API_KEY no .env da raiz (chave grátis em etherscan.io/myapikey).");
  const arquivo = path.join(__dirname, "..", "deployments", hre.network.name + ".json");
  if (!fs.existsSync(arquivo)) throw new Error("Não achei " + arquivo + ". Rode o deploy.js primeiro.");
  const dep = JSON.parse(fs.readFileSync(arquivo, "utf8"));

  await verificar("OathChain", dep.OathChain, []);
  // a GestaoRevisores recebe o endereço do OathChain no construtor (ver scripts/deploy.js)
  if (dep.GestaoRevisores) await verificar("GestaoRevisores", dep.GestaoRevisores, [dep.OathChain]);
}

main().catch((erro) => {
  console.error(erro.message || erro);
  process.exitCode = 1;
});
