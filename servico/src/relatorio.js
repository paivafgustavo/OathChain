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
    especialidade: analise.especialidade, filtro: analise.filtro, consultas: analise.consultas, evidencias: analise.evidencias,
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

/** Manda o texto exato para o IPFS pela Pinata e devolve o CID. */
export async function enviarParaIPFS({ texto, hash }) {
  const form = new FormData();
  form.append("file", new Blob([texto], { type: "application/json" }), `${hash}.json`);
  form.append("pinataMetadata", JSON.stringify({ name: `oathchain-relatorio-${hash.slice(0, 10)}` }));
  const r = await fetch(`${config.pinataBase}/pinning/pinFileToIPFS`, {
    method: "POST", headers: { Authorization: `Bearer ${config.pinataJwt}` }, body: form, signal: AbortSignal.timeout(30000),
  });
  if (!r.ok) throw new Error("Pinata respondeu " + r.status);
  const { IpfsHash } = await r.json();
  if (!/^(Qm[1-9A-HJ-NP-Za-km-z]{44}|b[a-z2-7]{20,})$/.test(String(IpfsHash))) throw new Error("CID inválido devolvido pela Pinata");
  return IpfsHash;
}

/**
 * Guarda o relatório no disco (sempre) e, se houver PINATA_JWT, também no IPFS.
 * Devolve a URL que vai para a blockchain: "ipfs://CID" (permanente) ou a URL do próprio serviço.
 */
export async function publicarRelatorio(rel, log = () => {}) {
  const urlLocal = salvarRelatorio(rel);
  if (!config.pinataJwt) return urlLocal;
  try {
    return "ipfs://" + (await enviarParaIPFS(rel));
  } catch (e) {
    log("  IPFS falhou, usando a URL do serviço: " + e.message);
    return urlLocal;
  }
}

export function lerRelatorio(hash) {
  if (!/^0x[0-9a-f]{64}$/i.test(hash)) return null;
  const arq = path.join(config.pastaRelatorios, `${hash.toLowerCase()}.json`);
  return fs.existsSync(arq) ? fs.readFileSync(arq, "utf8") : null;
}

export const conferirHash = (texto) => keccak256(toUtf8Bytes(texto));
