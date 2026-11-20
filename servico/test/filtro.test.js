import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

process.env.DEMO = "1"; // nada aqui chama IA de verdade
const { classificarPorRegras, filtrarFatoOpiniao } = await import("../src/filtro.js");
const { calcularMetricas, validarDataset } = await import("../src/acuracia.js");
const { verificarAfirmacao } = await import("../src/agentes.js");

test("filtro: opinião em primeira pessoa e juízo de valor sem fato são barrados", () => {
  assert.equal(classificarPorRegras("Eu acho que este é o melhor governo da história.").tipo, "opiniao");
  assert.equal(classificarPorRegras("Brasília é a cidade mais bonita do Brasil.").tipo, "opiniao");
  assert.equal(classificarPorRegras("Esse ministro é péssimo e incompetente.").tipo, "opiniao");
});

test("filtro: entende acentos (o \\b do JavaScript não entende)", () => {
  assert.equal(classificarPorRegras("O time será campeão.").tipo, "previsao");
  assert.equal(classificarPorRegras("Na minha opinião isso é ótimo.").tipo, "opiniao");
  // "ótimo" dentro de outra palavra não conta
  assert.equal(classificarPorRegras("O PIB cresceu 3% em 2024").tipo, "fato");
});

test("filtro: fatos com número, órgão ou ação verificável passam com certeza alta", () => {
  for (const t of ["O PIB do Brasil cresceu 3,4% em 2024, segundo o IBGE.", "O Congresso aprovou a reforma tributária.", "A inflação caiu no último trimestre."]) {
    const c = classificarPorRegras(t);
    assert.equal(c.tipo, "fato", t);
    assert.equal(c.certeza, "alta", t);
  }
});

test("filtro: frase mista (fato + adjetivo) não é barrada", () => {
  const c = classificarPorRegras("O PIB cresceu 3% em 2024, o melhor resultado em uma década.");
  assert.equal(c.tipo, "fato");
  assert.equal(c.certeza, "baixa");
});

test("filtro: previsão sem dado é barrada; promessa com número passa", () => {
  assert.equal(classificarPorRegras("A seleção brasileira vai ganhar a próxima Copa do Mundo.").tipo, "previsao");
  assert.equal(classificarPorRegras("O governo vai construir 500 escolas até 2027.").tipo, "fato");
});

test("filtro em modo demonstração não chama IA e deixa passar os casos duvidosos", async () => {
  const r = await filtrarFatoOpiniao("O céu estava diferente naquele dia.", { demo: true });
  assert.equal(r.verificavel, true);
  assert.equal(r.origem, "regras");
});

test("opinião não chama os agentes: vai Inconclusiva, confiança 0, com o motivo", async () => {
  const r = await verificarAfirmacao({ texto: "Eu acho que esse prefeito é o pior de todos." }, { demo: true });
  assert.equal(r.filtro.verificavel, false);
  assert.equal(r.resultado.veredito, "Inconclusiva");
  assert.equal(r.resultado.confianca, 0);
  assert.equal(r.evidencias.length, 0);
  assert.match(r.resultado.motivos[0], /opinião/);
});

test("métricas de acurácia: cobertura, precisão do automático e erros graves", () => {
  const m = calcularMetricas([
    { esperado: "Verdadeira", veredito: "Verdadeira", confianca: 90, verificavel: true }, // auto, certo
    { esperado: "Falsa", veredito: "Verdadeira", confianca: 80, verificavel: true }, // auto, erro grave
    { esperado: "Falsa", veredito: "Falsa", confianca: 50, verificavel: true }, // certo, mas vai ao júri
    { esperado: "Verdadeira", veredito: "Inconclusiva", confianca: 0, verificavel: false }, // barrado por engano
    { esperado: "opiniao", veredito: "Inconclusiva", confianca: 0, verificavel: false }, // detectada
    { esperado: "previsao", veredito: "Verdadeira", confianca: 85, verificavel: true }, // escapou
  ]);
  assert.equal(m.fatos, 4);
  assert.equal(m.acertoGeral, 50);
  assert.equal(m.coberturaAutomatica, 50);
  assert.equal(m.precisaoAutomatica, 50);
  assert.equal(m.errosGraves, 1);
  assert.equal(m.fatosBarradosPeloFiltro, 1);
  assert.equal(m.opinioesDetectadas, 50);
  assert.deepEqual(m.matriz.Falsa, { Verdadeira: 1, Falsa: 1 });
});

test("a base de acurácia é válida e o filtro acerta todos os itens dela", () => {
  const { afirmacoes } = JSON.parse(fs.readFileSync(new URL("../dados/acuracia.json", import.meta.url), "utf8"));
  validarDataset(afirmacoes);
  for (const a of afirmacoes) {
    const esperado = a.esperado === "opiniao" || a.esperado === "previsao" ? a.esperado : "fato";
    assert.equal(classificarPorRegras(a.texto).tipo, esperado, a.texto);
  }
  assert.throws(() => validarDataset([{ texto: "curto", esperado: "Verdadeira" }]));
  assert.throws(() => validarDataset([{ texto: "texto comprido o bastante", esperado: "talvez" }]));
});

test("acurácia: item em que a IA não respondeu (cota) fica fora da conta", () => {
  const m = calcularMetricas([
    { esperado: "Verdadeira", veredito: "Verdadeira", confianca: 90, verificavel: true },
    { esperado: "Verdadeira", veredito: "Inconclusiva", confianca: 0, verificavel: true, falhaDeIA: true },
  ]);
  assert.equal(m.falhasDeIA, 1);
  assert.equal(m.fatos, 1);
  assert.equal(m.acertoGeral, 100);
});

test("acurácia --continuar: junta rodadas sem perder o que já foi medido", async () => {
  const { juntarResultados } = await import("../src/acuracia.js");
  const ordem = [{ texto: "A" }, { texto: "B" }, { texto: "C" }];
  const antes = [{ texto: "A", veredito: "Verdadeira" }, { texto: "B", falhaDeIA: true }];
  const depois = [{ texto: "A", falhaDeIA: true }, { texto: "B", veredito: "Falsa" }, { texto: "C", falhaDeIA: true }];
  const j = juntarResultados(antes, depois, ordem);
  assert.deepEqual(j.map((r) => r.texto), ["A", "B", "C"]);
  assert.equal(j[0].veredito, "Verdadeira", "falha nova não apaga medição antiga");
  assert.equal(j[1].veredito, "Falsa", "medição nova substitui falha antiga");
  assert.equal(j[2].falhaDeIA, true);
});

test("acurácia: item sem nenhuma fonte da web porque a busca ficou sem créditos (402) fica fora da conta", async () => {
  const { semBuscaWeb } = await import("../src/acuracia.js");
  const sem = { avisos: ["buscarFirecrawl: api.firecrawl.dev respondeu 402"], fontesWeb: 0 };
  assert.equal(semBuscaWeb(sem), true);
  assert.equal(semBuscaWeb({ ...sem, fontesWeb: 2 }), false, "a Tavily cobriu: a medição vale");
  assert.equal(semBuscaWeb({ avisos: ["buscarFirecrawl: The operation was aborted due to timeout"], fontesWeb: 0 }), false, "timeout isolado não é falta de crédito");
  assert.equal(semBuscaWeb({ avisos: ["buscarFirecrawl: api.firecrawl.dev respondeu 402"] }), true, "resultado antigo, sem o campo fontesWeb");
});
