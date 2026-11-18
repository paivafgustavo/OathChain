import { keccak256, toUtf8Bytes } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { config } from "./config.js";

/**
 * O relatório é guardado como TEXTO exato e o hash (keccak256) desse texto vai para a blockchain.
 * Qualquer pessoa confere: baixa o arquivo, calcula keccak256 do texto e compara com o hash on-chain.
 */
export function montarRelatorio({ registro, analise, versao = "1" }) {
  const corpo = {
    versao, geradoEm: new Date().toISOString(), registro, simulado: analise.simulado,
    especialidade: analise.especialidade, consultas: analise.consultas, evidencias: analise.evidencias,
    agentes: { avaliadorDeFontes: analise.avaliacaoDeFontes, analista: analise.analista, contraditor: analise.contraditor, replicaDoAnalista: analise.replicaDoAnalista },
    resultado: analise.resultado, avisos: analise.avisos,
  };
  const texto = JSON.stringify(corpo, null, 2);
  const hash = keccak256(toUtf8Bytes(texto));
  return { texto, hash };
}

export function salvarRelatorio({ texto, hash }) {
  fs.mkdirSync(config.pastaRelatorios, { recursive: true });
  fs.writeFileSync(path.join(config.pastaRelatorios, `${hash}.json`), texto, "utf8");
  return `${config.urlPublica}/relatorios/${hash}.json`;
}

export function lerRelatorio(hash) {
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) return null;
  const arq = path.join(config.pastaRelatorios, `${hash.toLowerCase()}.json`);
  return fs.existsSync(arq) ? fs.readFileSync(arq, "utf8") : null;
}

export const conferirHash = (texto) => keccak256(toUtf8Bytes(texto));
