import http from "node:http";
import { pathToFileURL } from "node:url";
import { config, modoDemo, temChaveDeIA } from "./config.js";
import { rodarUmaVez, lerEstado, dentroDoLimite } from "./processador.js";
import { lerRelatorio } from "./relatorio.js";
import { verificarAfirmacao } from "./agentes.js";

const pedidosPorIp = new Map(); // limite simples: 5 testes por hora por IP
function liberado(ip) {
  const agora = Date.now();
  const lista = (pedidosPorIp.get(ip) || []).filter((t) => agora - t < 3600_000);
  if (lista.length >= 5) return false;
  lista.push(agora);
  pedidosPorIp.set(ip, lista);
  return true;
}

export function criarServidor() {
  return http.createServer(async (req, res) => {
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Content-Type" };
    const json = (c, o) => { res.writeHead(c, { "Content-Type": "application/json; charset=utf-8", ...cors }); res.end(JSON.stringify(o)); };
    if (req.method === "OPTIONS") { res.writeHead(204, cors); return res.end(); }
    const url = new URL(req.url, "http://x");

    if (url.pathname === "/saude") return json(200, { ok: true, demo: modoDemo(), iaConfigurada: temChaveDeIA() });

    const m = url.pathname.match(/^\/relatorios\/(0x[0-9a-fA-F]{64})\.json$/);
    if (m) {
      const texto = lerRelatorio(m[1]);
      if (!texto) return json(404, { erro: "Relatório não encontrado" });
      res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", ...cors });
      return res.end(texto); // texto EXATO: o hash confere com o da blockchain
    }

    // Teste rápido sem blockchain: POST /verificar {texto, assunto, referencia}
    if (url.pathname === "/verificar" && req.method === "POST") {
      const ip = req.socket.remoteAddress || "?";
      if (!liberado(ip)) return json(429, { erro: "Muitos pedidos. Tente mais tarde." });
      const estado = lerEstado();
      if (!dentroDoLimite(estado)) return json(429, { erro: "Limite diário do serviço atingido." });
      let corpo = "";
      for await (const parte of req) { corpo += parte; if (corpo.length > 10_000) return json(413, { erro: "Texto grande demais" }); }
      try {
        const { texto, assunto, referencia } = JSON.parse(corpo);
        if (typeof texto !== "string" || texto.trim().length < 10 || texto.length > 1000) return json(400, { erro: "Texto de 10 a 1000 caracteres" });
        return json(200, await verificarAfirmacao({ texto, assunto, referencia }));
      } catch (e) { return json(400, { erro: e.message }); }
    }
    json(404, { erro: "Rota inexistente" });
  });
}

// pathToFileURL: no Windows o caminho tem "\", "C:" e espaços; comparar com "file://" + argv nunca batia
// e o `npm start` saía sem rodar nada.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  criarServidor().listen(config.porta, () => console.log(`Serviço no ar: http://localhost:${config.porta} (${modoDemo() ? "MODO DEMONSTRAÇÃO" : "IA real"})`));
  const ciclo = async () => { try { await rodarUmaVez(); } catch (e) { console.error("Ciclo falhou:", e.message); } };
  ciclo();
  setInterval(ciclo, config.intervalo * 1000);
}
