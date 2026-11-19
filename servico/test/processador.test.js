import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DEMO = "1";
const { finalizarProntos } = await import("../src/processador.js");

// Contrato falso: #1 Registrada, #2 em votação com todos votando, #3 em votação esperando votos, #4 finalizada
function contratoFalso() {
  const estados = { 1: 0, 2: 1, 3: 1, 4: 2 };
  const enviados = [];
  const finalizar = async (id) => { enviados.push(id); estados[id] = 2; return { hash: "0xabc" + id, wait: async () => {} }; };
  finalizar.staticCall = async (id) => { if (id !== 2) throw new Error("Aguarde o fim da votacao"); };
  return { enviados, finalizar, obterRegistro: async (id) => ({ estado: estados[id] }) };
}

test("encerramento automático: só envia finalizar quando o contrato aceitaria (todos votaram ou prazo acabou)", async () => {
  const c = contratoFalso();
  const logs = [];
  const r = await finalizarProntos(c, 5, (m) => logs.push(m));
  assert.deepEqual(r, [2]);
  assert.deepEqual(c.enviados, [2], "não gasta gás com #3 (ainda esperando votos) nem com #1/#4 (fora de votação)");
  assert.match(logs[0], /#2: votação encerrada automaticamente/);
});

test("encerramento automático: falha ao enviar não derruba o ciclo", async () => {
  const c = contratoFalso();
  c.finalizar = Object.assign(async () => { throw new Error("rede caiu"); }, { staticCall: async () => {} });
  const logs = [];
  const r = await finalizarProntos(c, 5, (m) => logs.push(m));
  assert.deepEqual(r, []);
  assert.ok(logs.some((l) => /tento no próximo ciclo/.test(l)));
});

test("falta de cota é detectada (e o serviço não grava 'Inconclusiva 0%' na blockchain)", async () => {
  const { iaSemResposta } = await import("../src/processador.js");
  assert.equal(iaSemResposta({ avisos: ["Analista falhou: Todos os provedores de IA falharam: groq: 429"] }), true);
  assert.equal(iaSemResposta({ avisos: ["finalizado sem problemas"] }), false);
  // só a réplica falhou: o parecer do analista vale, então a análise conta
  assert.equal(iaSemResposta({ avisos: ["Réplica falhou, mantido o parecer inicial: Todos os provedores de IA falharam: 429"] }), false);
  assert.equal(iaSemResposta({ avisos: [] }), false);
});
