import fs from "node:fs";
import { config, modoDemo } from "./config.js";
import { conectar, lerConteudo, enviarVerificacao } from "./chain.js";
import { verificarAfirmacao, agenteSemResposta } from "./agentes.js";
import { montarRelatorio, publicarRelatorio } from "./relatorio.js";

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

// Uma verificação com IA real leva mais que o intervalo (30 s). Sem esta trava, o ciclo seguinte começava
// antes do anterior terminar e as mesmas afirmações eram verificadas 2 ou 3 vezes em paralelo
// (cota de IA gasta à toa e transações revertidas com "Estado invalido").
let emAndamento = null;

// Cota de IA esgotada: não grava nada e só tenta de novo depois desta pausa (não gasta Firecrawl à toa)
export const PAUSA_SEM_COTA_MS = 10 * 60 * 1000;
let pausadoAte = 0;
export const iaSemResposta = (analise) => agenteSemResposta(analise.avisos);

/** Procura afirmações 'Registrada' e verifica cada uma. Devolve quantas foram enviadas. */
export function rodarUmaVez(log = console.log) {
  if (emAndamento) return Promise.resolve(0); // o ciclo anterior ainda está rodando: pula este
  emAndamento = rodar(log).finally(() => { emAndamento = null; });
  return emAndamento;
}

async function rodar(log) {
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
    if (Date.now() < pausadoAte) break; // esperando a cota de IA voltar
    try {
      log(`Verificando afirmação #${id}...`);
      const texto = await lerConteudo(reg.cidConteudo);
      const analise = await verificarAfirmacao({ texto, referencia: reg.referencia }, { demo: modoDemo() });
      // Falta de cota NÃO é opinião da IA: não grava "Inconclusiva 0%" na blockchain; tenta mais tarde
      if (!analise.simulado && iaSemResposta(analise)) {
        pausadoAte = Date.now() + PAUSA_SEM_COTA_MS;
        log(`  #${id}: a IA não respondeu (cota/limite). Nada foi gravado; tento de novo em ${PAUSA_SEM_COTA_MS / 60000} min.`);
        log("     " + analise.avisos.find((m) => /falh/i.test(m)).slice(0, 200));
        break;
      }
      const rel = montarRelatorio({ registro: { id, autor: reg.autor, texto, referencia: reg.referencia }, analise });
      // a IA demora: confere de novo se ninguém mudou o estado nesse meio-tempo, para não enviar uma transação que reverte
      if (Number((await contrato.obterRegistro(id)).estado) !== 0) {
        log(`  #${id} mudou de estado durante a análise; nada a enviar.`);
        estado.processados[id] = true;
        salvarEstado(estado);
        continue;
      }
      const url = await publicarRelatorio(rel, log);
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
  await finalizarProntos(contrato, proximo, log);
  return enviadas;
}

/**
 * Encerramento automático da votação. A blockchain não executa nada sozinha: alguém precisa mandar a
 * transação "finalizar". O serviço faz isso assim que o CONTRATO aceitar, ou seja, quando todos os
 * sorteados já votaram ou quando o prazo acabou. Antes, simula a chamada (staticCall, de graça):
 * se o contrato recusaria ("Aguarde o fim da votacao", "Sem maioria ainda"...), não gasta gás.
 * Quem decide se pode encerrar continua sendo o contrato; o serviço só aperta o botão.
 *
 * O mesmo vale para o veredito PROVISÓRIO da IA: quando a janela de recurso acaba sem ninguém recorrer,
 * o serviço chama "confirmarIA" (o contrato confere o prazo). Sem isso, o registro ficava parado em
 * "Pode ser confirmado" até alguém clicar no botão.
 */
const ACOES_AUTOMATICAS = {
  1: { funcao: "finalizar", texto: "votação encerrada automaticamente (todos votaram ou o prazo acabou)" }, // EmVerificacao
  4: { funcao: "confirmarIA", texto: "veredito da IA confirmado automaticamente (ninguém recorreu no prazo)" }, // Provisoria
};

export async function finalizarProntos(contrato, proximo, log = console.log) {
  const finalizados = [];
  for (let id = 1; id < proximo; id++) {
    try {
      const acao = ACOES_AUTOMATICAS[Number((await contrato.obterRegistro(id)).estado)];
      if (!acao) continue;
      try { await contrato[acao.funcao].staticCall(id); } catch { continue; } // ainda não pode: espera
      const tx = await contrato[acao.funcao](id);
      await tx.wait();
      log(`  #${id}: ${acao.texto} tx ${tx.hash}`);
      finalizados.push(id);
    } catch (e) {
      log(`  #${id}: não consegui concluir agora (${e.shortMessage || e.message}); tento no próximo ciclo.`);
    }
  }
  return finalizados;
}
