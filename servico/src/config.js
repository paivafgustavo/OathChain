import "dotenv/config";

const e = process.env;
const num = (v, padrao) => (v !== undefined && v !== "" && !Number.isNaN(Number(v)) ? Number(v) : padrao);

export const config = {
  groqKey: e.GROQ_API_KEY || "",
  geminiKey: e.GEMINI_API_KEY || "",
  openrouterKey: e.OPENROUTER_API_KEY || "",
  firecrawlKey: e.FIRECRAWL_API_KEY || "",
  tavilyKey: e.TAVILY_API_KEY || "",
  factcheckKey: e.FACTCHECK_API_KEY || "",
  // endereços das APIs (podem ser trocados nos testes)
  groqBase: e.GROQ_BASE || "https://api.groq.com/openai/v1",
  geminiBase: e.GEMINI_BASE || "https://generativelanguage.googleapis.com/v1beta/openai",
  openrouterBase: e.OPENROUTER_BASE || "https://openrouter.ai/api/v1",
  firecrawlBase: e.FIRECRAWL_BASE || "https://api.firecrawl.dev/v1",
  tavilyBase: e.TAVILY_BASE || "https://api.tavily.com",
  factcheckBase: e.FACTCHECK_BASE || "https://factchecktools.googleapis.com/v1alpha1",
  wikipediaBase: e.WIKIPEDIA_BASE || "https://pt.wikipedia.org/w/api.php",
  rpcUrl: e.RPC_URL || "",
  contrato: e.CONTRACT_ADDRESS || "",
  chaveAgente: e.PRIVATE_KEY_AGENTE || "",
  limiteDiario: num(e.LIMITE_DIARIO, 50),
  intervalo: num(e.INTERVALO_SEGUNDOS, 30),
  // PORT: variável que Render, Railway e Fly usam para dizer em que porta o serviço deve escutar
  // (a da plataforma tem prioridade sobre a do .env)
  porta: num(e.PORT, num(e.PORTA, 8787)),
  urlPublica: (e.URL_PUBLICA || `http://localhost:${num(e.PORT, num(e.PORTA, 8787))}`).replace(/\/$/, ""),
  // IPFS (opcional): com PINATA_JWT o relatório vai para o IPFS e a blockchain guarda "ipfs://CID"
  pinataJwt: e.PINATA_JWT || "",
  pinataBase: e.PINATA_BASE || "https://api.pinata.cloud",
  pastaRelatorios: e.PASTA_RELATORIOS || "relatorios",
  arquivoEstado: e.ARQUIVO_ESTADO || "estado.json",
};

export function temChaveDeIA() {
  return Boolean(config.groqKey || config.geminiKey || config.openrouterKey);
}

/** Modo demonstração: sem chaves de IA (ou DEMO=1) tudo é simulado e o relatório avisa isso. */
export function modoDemo() {
  return e.DEMO === "1" || !temChaveDeIA();
}
