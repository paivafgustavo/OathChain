import fs from "node:fs";
import { config, modoDemo } from "./config.js";
import { conectar, lerConteudo, enviarVerificacao } from "./chain.js";
import { verificarAfirmacao } from "./agentes.js";
import { montarRelatorio, salvarRelatorio } from "./relatorio.js";

const hoje = () => new Date().toISOString().slice(0, 10);

export function lerEstado() {
  try { return JSON.parse(fs.readFileSync(config.arquivoEstado, "utf8")); } catch { return { processados: {}, tentativas: {}, dia: hoje(), usadosHoje: 0 }; }
}
const salvarEstado = (e) => fs.writeFileSync(config.arquivoEstado, JSON.stringify(e, null, 2));

/** Limite diário: protege as cotas gratuitas e impede que alguém esgote o serviço com spam. */
export function dentroDoLimite(estado) {
  if (estado.dia !== hoje()) { estado.dia = hoje(); estado.usadosHoje = 0; }
  return estado.usadosHoje < config.limiteDiario;
}

/** Procura afirmações 'Registrada' e verifica cada uma. Devolve quantas foram enviadas. */
export async function rodarUmaVez(log = console.log) {
  const { contrato } = conectar();
  const estado = lerEstado();
  const proximo = Number(await contrato.proximoId());
  let enviadas = 0;
  for (let id = 1; id < proximo; id++) {
    if (estado.processados[id]) continue;
    const reg = await contrato.obterRegistro(id);
    // tipo 0 = Afirmação, estado 0 = Registrada
    if (Number(reg.tipo) !== 0 || Number(reg.estado) !== 0) { estado.processados[id] = true; continue; }
    if (!dentroDoLimite(estado)) { log(`Limite diário (${config.limiteDiario}) atingido; o resto fica para amanhã.`); break; }
    try {
      log(`Verificando afirmação #${id}...`);
      const texto = await lerConteudo(reg.cidConteudo);
      const analise = await verificarAfirmacao({ texto, referencia: reg.referencia }, { demo: modoDemo() });
      const rel = montarRelatorio({ registro: { id, autor: reg.autor, texto, referencia: reg.referencia }, analise });
      const url = salvarRelatorio(rel);
      const tx = await enviarVerificacao(contrato, id, analise.resultado, rel.hash, url);
      log(`  #${id}: ${analise.resultado.veredito} (${analise.resultado.confianca}%) tx ${tx}`);
      estado.processados[id] = true;
      estado.usadosHoje += 1;
      enviadas += 1;
    } catch (e) {
      estado.tentativas[id] = (estado.tentativas[id] || 0) + 1;
      log(`  #${id} falhou (${estado.tentativas[id]}/3): ${e.message}`);
      if (estado.tentativas[id] >= 3) estado.processados[id] = true; // desiste para não travar a fila
    }
    salvarEstado(estado);
  }
  salvarEstado(estado);
  return enviadas;
}
