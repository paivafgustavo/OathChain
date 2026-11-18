const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

// Algumas contas (com "conta inteligente" da MetaMask) só aceitam 1 transação em andamento no Alchemy.
// Se der esse erro, espera a anterior confirmar e tenta de novo.
async function tentar(fn) {
  for (let i = 0; i < 12; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!/in-flight|replacement transaction|nonce too low/i.test(String(e.message))) throw e;
      console.log("Aguardando a transação anterior confirmar... (tentativa " + (i + 1) + ")");
      await dormir(15000);
    }
  }
  throw new Error("A rede não liberou novas transações. Veja a conta no Etherscan e tente de novo em alguns minutos.");
}

async function main() {
  const [conta] = await hre.ethers.getSigners();
  console.log("Publicando com a conta:", conta.address);

  const saldo = await hre.ethers.provider.getBalance(conta.address);
  console.log("Saldo:", hre.ethers.formatEther(saldo), "ETH");

  const oathChain = await tentar(() => hre.ethers.deployContract("OathChain"));
  await oathChain.waitForDeployment();
  const endereco = await oathChain.getAddress();
  console.log("OathChain publicado em:", endereco);

  // Contrato de candidatura e período de prova dos revisores
  await dormir(5000);
  const gestao = await tentar(() => hre.ethers.deployContract("GestaoRevisores", [endereco]));
  await gestao.waitForDeployment();
  const enderecoGestao = await gestao.getAddress();
  const blocoDeploy = (await oathChain.deploymentTransaction().wait()).blockNumber;
  console.log("GestaoRevisores publicado em:", enderecoGestao);
  await tentar(async () => (await oathChain.definirGestao(enderecoGestao)).wait());

  // Carteira do serviço de IA (opcional: AGENTE_VERIFICADOR no .env)
  if (process.env.AGENTE_VERIFICADOR) {
    await tentar(async () => (await oathChain.definirAgenteVerificador(process.env.AGENTE_VERIFICADOR)).wait());
    console.log("Agente verificador (IA):", process.env.AGENTE_VERIFICADOR);
  }

  // MODO DEMONSTRAÇÃO (DEMO=1): tudo rápido para mostrar ao vivo. Sem DEMO, valem os padrões do contrato.
  if (process.env.DEMO === "1") {
    await tentar(async () => (await oathChain.definirJanelaVotacao(1200)).wait());     // 20 min para votar (voto + justificativa juntos)
    await tentar(async () => (await oathChain.definirJanelaContestacao(300)).wait());  // 5 min
    await tentar(async () => (await oathChain.definirJanelaRevisaoIA(300)).wait());    // 5 min para recorrer da IA
    await tentar(async () => (await oathChain.definirJuri(3, 2, false)).wait());
    await tentar(async () => (await gestao.definirParametros(hre.ethers.parseEther("0.001"), 2, 2, 600, 20, 600, 50)).wait());
    console.log("Modo demonstração ligado (janelas curtas, depósito 0.001 ETH, prova de 2 votos).");
  }
  console.log("Ver no explorador: https://sepolia.etherscan.io/address/" + endereco);

  // Guarda os endereços em deployments/<rede>.json (são públicos, podem ir para o GitHub)
  const pasta = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(pasta, { recursive: true });
  const arquivo = path.join(pasta, hre.network.name + ".json");
  fs.writeFileSync(
    arquivo,
    JSON.stringify(
      {
        OathChain: endereco,
        GestaoRevisores: enderecoGestao,
        bloco: blocoDeploy,
        rede: hre.network.name,
        publicadoEm: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log("Endereços salvos em:", arquivo);

  // Na Sepolia, também atualiza a interface sozinho (frontend/src/deployment.json)
  const pastaInterface = path.join(__dirname, "..", "frontend", "src");
  if (hre.network.name === "sepolia" && fs.existsSync(pastaInterface)) {
    const arquivoInterface = path.join(pastaInterface, "deployment.json");
    fs.writeFileSync(arquivoInterface, JSON.stringify({ OathChain: endereco, GestaoRevisores: enderecoGestao, bloco: blocoDeploy }, null, 2));
    console.log("Interface atualizada com o novo endereço:", arquivoInterface);
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exitCode = 1;
});
