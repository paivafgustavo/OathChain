// Cliente de IA com provedores 100% gratuitos (API compatível com OpenAI) e troca automática
// quando um provedor atinge o limite. Cada agente prefere um provedor diferente (diversidade).
import { config, modoDemo } from "./config.js";

export function provedores() {
  const lista = [];
  if (config.groqKey) lista.push({ nome: "groq", base: config.groqBase, chave: config.groqKey, modelo: "llama-3.3-70b-versatile", json: true });
  if (config.geminiKey) lista.push({ nome: "gemini", base: config.geminiBase, chave: config.geminiKey, modelo: "gemini-flash-latest", json: true });
  if (config.openrouterKey) lista.push({ nome: "openrouter", base: config.openrouterBase, chave: config.openrouterKey, modelo: "meta-llama/llama-3.3-70b-instruct:free", json: false });
  return lista;
}

/** Extrai o primeiro objeto JSON de um texto (modelos às vezes colocam ```json ... ```). */
export function extrairJSON(texto) {
  if (typeof texto !== "string") throw new Error("Resposta vazia da IA");
  const limpo = texto.replace(/```json|```/gi, "");
  const ini = limpo.indexOf("{");
  const fim = limpo.lastIndexOf("}");
  if (ini < 0 || fim <= ini) throw new Error("A IA não devolveu JSON");
  return JSON.parse(limpo.slice(ini, fim + 1));
}

async function chamar(p, sistema, usuario) {
  const corpo = {
    model: p.modelo,
    temperature: 0.2,
    messages: [
      { role: "system", content: sistema },
      { role: "user", content: usuario },
    ],
  };
  if (p.json) corpo.response_format = { type: "json_object" };
  const r = await fetch(`${p.base}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${p.chave}` },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(60000),
  });
  if (!r.ok) {
    const erro = new Error(`${p.nome} respondeu ${r.status}`);
    erro.status = r.status;
    throw erro;
  }
  const dados = await r.json();
  return extrairJSON(dados?.choices?.[0]?.message?.content);
}

/**
 * Pergunta e recebe um objeto JSON.
 * @param prefere índice do agente (0..3): começa por um provedor diferente para cada agente.
 */
export async function perguntarJSON(sistema, usuario, { prefere = 0 } = {}) {
  const lista = provedores();
  if (lista.length === 0) throw new Error("Nenhum provedor de IA configurado");
  const falhas = [];
  for (let i = 0; i < lista.length; i++) {
    const p = lista[(prefere + i) % lista.length];
    for (let tentativa = 0; tentativa < 2; tentativa++) {
      try {
        const resposta = await chamar(p, sistema, usuario);
        return { resposta, provedor: p.nome };
      } catch (erro) {
        falhas.push(`${p.nome}: ${erro.message}`);
        // limite de uso (429) ou erro do servidor: vai para o próximo provedor; JSON ruim: tenta 1x de novo
        if (erro.status === 429 || erro.status >= 500 || erro.status === 401 || erro.status === 403) break;
      }
    }
  }
  throw new Error("Todos os provedores de IA falharam: " + falhas.join(" | "));
}

export { modoDemo };
