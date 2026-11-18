import { ethers } from "ethers";
import fs from "node:fs";
import { config } from "./config.js";

const abi = JSON.parse(fs.readFileSync(new URL("../abi.json", import.meta.url), "utf8"));

export function conectar() {
  if (!config.rpcUrl || !config.contrato || !config.chaveAgente) {
    throw new Error("Preencha RPC_URL, CONTRACT_ADDRESS e PRIVATE_KEY_AGENTE no .env");
  }
  const provider = new ethers.JsonRpcProvider(config.rpcUrl);
  const carteira = new ethers.Wallet(config.chaveAgente.startsWith("0x") ? config.chaveAgente : "0x" + config.chaveAgente, provider);
  const contrato = new ethers.Contract(config.contrato, abi, carteira);
  return { provider, carteira, contrato };
}

/** Conteúdo da afirmação: texto direto, ou um ipfs:// lido por um gateway público. */
export async function lerConteudo(cid) {
  if (!/^(ipfs:\/\/|Qm|bafy)/.test(cid)) return cid;
  const caminho = cid.replace("ipfs://", "");
  const r = await fetch(`https://ipfs.io/ipfs/${caminho}`, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error("Não consegui ler o conteúdo no IPFS");
  return (await r.text()).slice(0, 4000);
}

export async function enviarVerificacao(contrato, id, resultado, hash, url) {
  const numero = { Verdadeira: 1, Falsa: 2, Inconclusiva: 3 }[resultado.veredito];
  const tx = await contrato.registrarVerificacaoIA(id, numero, resultado.confianca, hash, url);
  await tx.wait();
  return tx.hash;
}
