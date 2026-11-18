// Coleta de evidências em fontes gratuitas. Todo texto vindo da web é tratado como DADO NÃO CONFIÁVEL.
import { config } from "./config.js";
import { lookup } from "node:dns/promises";
import net from "node:net";

const MAX_TRECHO = 1500;
const corta = (t) => String(t || "").replace(/\s+/g, " ").trim().slice(0, MAX_TRECHO);

async function pegar(url, opcoes = {}) {
  const r = await fetch(url, { ...opcoes, signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${new URL(url).host} respondeu ${r.status}`);
  return r.json();
}

/** Proteção contra SSRF: só http(s), nunca endereços internos. */
export async function urlSegura(url, { resolver = true } = {}) {
  let u;
  try { u = new URL(url); } catch { return false; }
  if (!["http:", "https:"].includes(u.protocol)) return false;
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal")) return false;
  if (!net.isIP(host) && !resolver) return true;
  const enderecos = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (enderecos.length === 0) return false;
  return enderecos.every(({ address }) => !ipPrivado(address));
}

function ipPrivado(ip) {
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    return l === "::1" || l === "::" || l.startsWith("fc") || l.startsWith("fd") || l.startsWith("fe80") || l.startsWith("::ffff:");
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

export async function buscarWikipedia(consulta) {
  const q = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: consulta, gsrlimit: "3", prop: "extracts|info",
    exintro: "1", explaintext: "1", exchars: "1200", inprop: "url", format: "json", origin: "*",
  });
  const d = await pegar(`${config.wikipediaBase}?${q}`);
  return Object.values(d?.query?.pages || {}).map((p) => ({
    origem: "wikipedia", titulo: p.title, url: p.fullurl, trecho: corta(p.extract),
  }));
}

export async function buscarChecagens(consulta) {
  if (!config.factcheckKey) return [];
  const q = new URLSearchParams({ query: consulta, languageCode: "pt", pageSize: "5", key: config.factcheckKey });
  const d = await pegar(`${config.factcheckBase}/claims:search?${q}`);
  const saida = [];
  for (const c of d?.claims || []) {
    for (const rev of c.claimReview || []) {
      saida.push({
        origem: "checagem", titulo: `${rev.publisher?.name || "Agência"}: ${rev.title || c.text}`, url: rev.url,
        trecho: corta(`Afirmação checada: "${c.text}". Classificação da agência: ${rev.textualRating || "n/d"}.`),
      });
    }
  }
  return saida.slice(0, 5);
}

export async function buscarFirecrawl(consulta) {
  if (!config.firecrawlKey) return [];
  const d = await pegar(`${config.firecrawlBase}/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.firecrawlKey}` },
    body: JSON.stringify({ query: consulta, limit: 3, lang: "pt", country: "br", scrapeOptions: { formats: ["markdown"], onlyMainContent: true } }),
  });
  return (d?.data || []).map((x) => ({
    origem: "firecrawl", titulo: x.title || x.url, url: x.url, trecho: corta(x.markdown || x.description),
  }));
}

export async function buscarDuckDuckGo(consulta) {
  const q = new URLSearchParams({ q: consulta, format: "json", no_html: "1", skip_disambig: "1" });
  const d = await pegar(`https://api.duckduckgo.com/?${q}`);
  const saida = [];
  if (d.AbstractText) saida.push({ origem: "duckduckgo", titulo: d.Heading || consulta, url: d.AbstractURL, trecho: corta(d.AbstractText) });
  return saida;
}

/** Roda todas as fontes para uma lista de consultas; uma fonte que falha não derruba as outras. */
export async function coletarEvidencias(consultas, { aoFalhar = () => {} } = {}) {
  const tarefas = [];
  for (const c of consultas) {
    for (const fn of [buscarChecagens, buscarWikipedia, buscarFirecrawl]) {
      tarefas.push(fn(c).catch((e) => { aoFalhar(`${fn.name}: ${e.message}`); return []; }));
    }
  }
  let achados = (await Promise.all(tarefas)).flat();
  if (achados.length === 0) {
    for (const c of consultas.slice(0, 1)) achados.push(...(await buscarDuckDuckGo(c).catch(() => [])));
  }
  // sem repetir o mesmo endereço; só links seguros
  const vistos = new Set();
  const finais = [];
  for (const a of achados) {
    const chave = a.url || a.titulo;
    if (!a.trecho || vistos.has(chave)) continue;
    // só exibimos o link (não o baixamos): basta barrar esquemas estranhos e endereços internos
    if (a.url && !(await urlSegura(a.url, { resolver: false }))) continue;
    vistos.add(chave);
    finais.push(a);
  }
  return finais.slice(0, 10).map((a, i) => ({ id: i + 1, ...a }));
}

/** Evidências fictícias, usadas SÓ no modo demonstração quando não há internet/chaves. */
export function evidenciasDemo() {
  return [
    { id: 1, origem: "demo", titulo: "(simulado) Fonte oficial de exemplo", url: "https://exemplo.gov.br/dados", trecho: "Conteúdo simulado para demonstração do fluxo." },
    { id: 2, origem: "demo", titulo: "(simulado) Reportagem de exemplo", url: "https://exemplo.com.br/noticia", trecho: "Conteúdo simulado para demonstração do fluxo." },
  ];
}
