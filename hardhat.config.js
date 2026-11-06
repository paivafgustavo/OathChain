require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

// Lê as variáveis secretas do arquivo .env (que NÃO vai para o GitHub)
const { SEPOLIA_RPC_URL, PRIVATE_KEY } = process.env;

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
  solidity: "0.8.24",
  networks,
};
