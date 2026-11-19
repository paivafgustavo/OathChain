require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Lê as variáveis secretas do arquivo .env (que NÃO vai para o GitHub)
const { SEPOLIA_RPC_URL, PRIVATE_KEY, ETHERSCAN_API_KEY } = process.env;

const networks = {};

// A rede Sepolia só é ativada se o .env estiver preenchido.
// Assim, "npx hardhat test" continua funcionando sem o .env.
if (SEPOLIA_RPC_URL && PRIVATE_KEY) {
  networks.sepolia = {
    url: SEPOLIA_RPC_URL,
    accounts: [PRIVATE_KEY.startsWith("0x") ? PRIVATE_KEY : "0x" + PRIVATE_KEY],
  };
}

module.exports = {
  // viaIR + otimizador reduzem o tamanho do contrato (o limite da rede é 24 KB)
  solidity: {
    version: "0.8.24",
    settings: { viaIR: true, optimizer: { enabled: true, runs: 50 } },
  },
  networks,
  // Verificação no Etherscan (scripts/verificar.js): publica o código-fonte para qualquer um conferir
  // que o contrato na rede é exatamente este. Chave grátis em etherscan.io/myapikey (vale para a Sepolia).
  etherscan: { apiKey: ETHERSCAN_API_KEY || "" },
  sourcify: { enabled: false },
};

