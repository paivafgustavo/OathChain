// Teste de acurácia: roda os 4 agentes contra afirmações cujo veredito já é conhecido
// (de preferência checadas por agências como Lupa, Aos Fatos, Comprova, Estadão Verifica)
// e mede quanto a IA acerta.
//
// Uso:  npm run acuracia                      (todas as afirmações de dados/acuracia.json)
//       npm run acuracia -- --max 5           (só as 5 primeiras, para poupar cota)
//       npm run acuracia -- --continuar        (mantém o que já foi medido e roda só o que falta)
//       npm run acuracia -- --arquivo outro.json
// O resultado completo fica em acuracia-resultado.json.
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export const ROTULOS = ["Verdadeira", "Falsa", "Inconclusiva", "opiniao", "previsao"];

/**
 * resultados: [{ esperado, veredito, confianca, verificavel }]
 * limite: confiança mínima para a IA decidir sozinha (no contrato: limiteConfianca = 70)
 */
export function calcularMetricas(todos, limite = 70) {
  // Item em que a IA nem respondeu (cota esgotada, erro de rede) não mede acerto: fica de fora e é contado à parte
  const resultados = todos.filter((r) => !r.falhaDeIA);
  const ehFato = (r) => r.esperado !== "opiniao" && r.esperado !== "previsao";
  const fatos = resultados.filter(ehFato);
  const opinioes = resultados.filter((r) => !ehFato(r));
  // "decidiu sozinha" = o contrato aceitaria como Provisória (confiança >= limite e não Inconclusiva)
  const automaticas = fatos.filter((r) => r.verificavel && r.veredito !== "Inconclusiva" && r.confianca >= limite);
  const acertosAuto = automaticas.filter((r) => r.veredito === r.esperado);
  const errosGraves = automaticas.filter((r) => r.veredito !== r.esperado && r.esperado !== "Inconclusiva");
  const matriz = {};
  for (const r of fatos) {
    const obtido = r.verificavel ? r.veredito : "barrada pelo filtro";
    matriz[r.esperado] ??= {};
    matriz[r.esperado][obtido] = (matriz[r.esperado][obtido] || 0) + 1;
  }
  const pct = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : null);
  return {
    total: resultados.length,
    falhasDeIA: todos.length - resultados.length,
    fatos: fatos.length,
    acertoGeral: pct(fatos.filter((r) => r.verificavel && r.veredito === r.esperado).length, fatos.length),
    coberturaAutomatica: pct(automaticas.length, fatos.length),
    precisaoAutomatica: pct(acertosAuto.length, automaticas.length),
    errosGraves: errosGraves.length,
    fatosBarradosPeloFiltro: fatos.filter((r) => !r.verificavel).length,
    opinioes: opinioes.length,
    opinioesDetectadas: pct(opinioes.filter((r) => !r.verificavel).length, opinioes.length),
    matriz,
  };
}

export function validarDataset(lista) {
  if (!Array.isArray(lista) || lista.length === 0) throw new Error("O arquivo precisa ter uma lista de afirmações");
  lista.forEach((a, i) => {
    if (typeof a.texto !== "string" || a.texto.length < 10) throw new Error(`Item ${i + 1}: "texto" faltando ou curto demais`);
    if (!ROTULOS.includes(a.esperado)) throw new Error(`Item ${i + 1}: "esperado" deve ser um de ${ROTULOS.join(", ")}`);
  });
  return lista;
}

/**
 * Junta uma rodada nova com a anterior (opção --continuar). Vale o resultado em que a IA respondeu;
 * uma falha de cota nunca apaga um item que já tinha sido medido. A ordem segue a do arquivo de dados.
 */
export function juntarResultados(anteriores, novos, ordem) {
  const porTexto = new Map();
  for (const r of [...anteriores, ...novos]) {
    const atual = porTexto.get(r.texto);
    if (!atual || !r.falhaDeIA || atual.falhaDeIA) porTexto.set(r.texto, r);
  }
  return ordem.map((a) => porTexto.get(a.texto)).filter(Boolean);
}

async function main() {
  const { verificarAfirmacao, agenteSemResposta } = await import("./agentes.js");
  const { modoDemo } = await import("./config.js");
  const arg = (n, p) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : p; };
  const arquivo = arg("arquivo", new URL("../dados/acuracia.json", import.meta.url));
  const max = Number(arg("max", Infinity));
  const pausa = Number(arg("pausa", 20)) * 1000; // respeita o limite de tokens POR MINUTO das APIs gratuitas
  const todosOsDados = validarDataset(JSON.parse(fs.readFileSync(arquivo, "utf8")).afirmacoes);
  const SAIDA = "acuracia-resultado.json";

  // --continuar: aproveita o que já foi medido e roda só o que falta (a cota grátis não aguenta tudo num dia)
  let anteriores = [];
  if (process.argv.includes("--continuar") && fs.existsSync(SAIDA)) {
    const antigo = JSON.parse(fs.readFileSync(SAIDA, "utf8"));
    if (!antigo.simulado) anteriores = antigo.resultados || [];
  }
  const medidos = new Set(anteriores.filter((r) => !r.falhaDeIA).map((r) => r.texto));
  const dados = todosOsDados.filter((a) => !medidos.has(a.texto)).slice(0, max);
  if (medidos.size) console.log(`Continuando: ${medidos.size} já medidas, faltam ${todosOsDados.length - medidos.size}.`);

  if (modoDemo()) console.log("⚠️  MODO DEMONSTRAÇÃO: sem chaves de IA o resultado é simulado e NÃO mede nada. Preencha o .env.\n");
  console.log(`Verificando ${dados.length} afirmações (pausa de ${pausa / 1000} s entre elas)...\n`);

  const resultados = [];
  let falhasSeguidas = 0;
  for (const [i, a] of dados.entries()) {
    const inicio = Date.now();
    let r;
    try {
      const analise = await verificarAfirmacao({ texto: a.texto, assunto: a.assunto, referencia: a.referencia || "" });
      // algum agente ficou sem resposta (429, cota, rede)? então o veredito não reflete a IA, e sim a falha
      const falhaDeIA = agenteSemResposta(analise.avisos);
      r = { ...a, veredito: analise.resultado.veredito, confianca: analise.resultado.confianca, verificavel: analise.filtro?.verificavel ?? true,
        fontes: analise.evidencias.length, votos: analise.resultado.votos, avisos: analise.avisos, falhaDeIA };
    } catch (e) {
      r = { ...a, veredito: "Inconclusiva", confianca: 0, verificavel: true, erro: e.message, falhaDeIA: true };
    }
    const certo = (r.esperado === "opiniao" || r.esperado === "previsao") ? !r.verificavel : r.verificavel && r.veredito === r.esperado;
    const icone = r.falhaDeIA ? "⚠️ " : certo ? "✅" : "❌";
    console.log(`${icone} ${i + 1}. esperado ${r.esperado}, IA ${r.verificavel ? `${r.veredito} (${r.confianca}%)` : "barrou no filtro"}: ${a.texto.slice(0, 70)}`);
    if (r.falhaDeIA) console.log("     (a IA não respondeu: " + String(r.erro || r.avisos.find((m) => /falhou|estimativa/.test(m))).slice(0, 140) + "...) fora da conta");
    resultados.push({ ...r, certo, segundos: Math.round((Date.now() - inicio) / 1000) });
    falhasSeguidas = r.falhaDeIA ? falhasSeguidas + 1 : 0;
    if (falhasSeguidas >= 2) {
      console.log("\n⛔ 2 falhas seguidas por cota: parei para não gastar à toa (o Firecrawl também tem limite).");
      console.log("   Quando a cota voltar (Gemini: no dia seguinte), rode:  npm run acuracia -- --continuar");
      break;
    }
    if (i < dados.length - 1) await new Promise((ok) => setTimeout(ok, pausa));
  }

  const juntos = juntarResultados(anteriores, resultados, todosOsDados);
  const m = calcularMetricas(juntos);
  console.log("\n================ RESULTADO ================");
  console.log(`Medidas: ${m.total} de ${todosOsDados.length} | fatos: ${m.fatos} | opiniões/previsões: ${m.opinioes}`);
  if (m.total < todosOsDados.length) console.log(`⚠️  ${todosOsDados.length - m.total} ainda sem medição (cota/limite). Depois rode: npm run acuracia -- --continuar`);
  console.log(`Acerto geral (fatos):                 ${m.acertoGeral ?? "-"}%`);
  console.log(`A IA decidiu sozinha (conf. >= 70):   ${m.coberturaAutomatica ?? "-"}% dos fatos`);
  console.log(`Precisão quando decide sozinha:       ${m.precisaoAutomatica ?? "-"}%   <- o número mais importante`);
  console.log(`Erros graves (Verdadeira <-> Falsa):  ${m.errosGraves}`);
  console.log(`Fatos barrados por engano no filtro:  ${m.fatosBarradosPeloFiltro}`);
  console.log(`Opiniões/previsões detectadas:        ${m.opinioesDetectadas ?? "-"}%`);
  console.log("Matriz (esperado -> obtido):", JSON.stringify(m.matriz));
  fs.writeFileSync(SAIDA, JSON.stringify({ geradoEm: new Date().toISOString(), simulado: modoDemo(), metricas: m, resultados: juntos }, null, 2));
  console.log(`\nDetalhes em ${SAIDA}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
