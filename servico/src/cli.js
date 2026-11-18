// Uso: node src/cli.js --texto "O PIB do Brasil cresceu 3% em 2024" --assunto Economia --ref 2024
import { verificarAfirmacao } from "./agentes.js";
import { modoDemo } from "./config.js";

const arg = (nome) => { const i = process.argv.indexOf("--" + nome); return i > 0 ? process.argv[i + 1] : ""; };
const texto = arg("texto");
if (!texto) { console.error('Uso: node src/cli.js --texto "afirmação" [--assunto Economia] [--ref 2024]'); process.exit(1); }
console.log(modoDemo() ? "(MODO DEMONSTRAÇÃO: respostas simuladas)\n" : "");
const r = await verificarAfirmacao({ texto, assunto: arg("assunto"), referencia: arg("ref") }, { aoProgresso: (m) => console.log(m) });
console.log("Especialidade:", r.especialidade, "| fontes:", r.evidencias.length);
for (const v of r.resultado.votos) console.log(` - ${v.agente}: ${v.veredito} (${v.confianca}%)`);
console.log(`\nRESULTADO: ${r.resultado.veredito} — confiança ${r.resultado.confianca}%`);
for (const m of r.resultado.motivos) console.log("  •", m);
for (const a of r.avisos) console.log("  aviso:", a);
