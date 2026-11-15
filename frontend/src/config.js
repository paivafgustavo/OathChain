// Configuração da interface.

import deployment from "./deployment.json";

// O endereço do contrato vem de deployment.json, que o deploy.js atualiza sozinho
// quando você publica na Sepolia. Só edite à mão se precisar apontar para outro contrato.
export const CONTRACT_ADDRESS = deployment.OathChain || "COLE_AQUI_O_ENDERECO_DO_CONTRATO";

// Rede Sepolia
export const CHAIN_ID = 11155111;
export const CHAIN_ID_HEX = "0xaa36a7";
export const NOME_DA_REDE = "Sepolia";
export const EXPLORADOR = "https://sepolia.etherscan.io";

// Usado para LER os dados quando a pessoa não tem a MetaMask instalada
export const RPC_PUBLICO = "https://ethereum-sepolia-rpc.publicnode.com";

// true  = só revisores veem o botão de registrar (decisão do projeto: evita registros duplicados)
// false = qualquer carteira conectada pode registrar (como o contrato permite hoje)
export const SO_REVISOR_REGISTRA = true;
