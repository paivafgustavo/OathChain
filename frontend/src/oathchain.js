// Funções de apoio: nomes legíveis, leitura e envio de dados do contrato.
import { id as hashTexto } from "ethers";
import { ST } from "./dados";

export const TIPOS = ["Afirmação", "Promessa"];
export const ESTADOS = ["Registrada", "Em verificação", "Finalizada", "Sem consenso"];
export const VEREDITOS = [
  "—",
  "Verdadeira",
  "Falsa",
  "Inconclusiva",
  "Cumprida",
  "Parcialmente cumprida",
  "Não cumprida",
];

// Vereditos que cada tipo aceita (números do enum do contrato)
export const VEREDITOS_DO_TIPO = [
  [1, 2, 3], // Afirmação
  [4, 5, 6], // Promessa
];

// ---------------------------------------------------------------
// Formatação
// ---------------------------------------------------------------

export function abreviar(endereco) {
  if (!endereco) return "";
  return endereco.slice(0, 6) + "…" + endereco.slice(-4);
}

export function formatarData(segundos) {
  const n = Number(segundos);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleString("pt-BR");
}

export function formatarDia(segundos) {
  const n = Number(segundos);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleDateString("pt-BR", { day: "numeric", month: "short", year: "numeric" });
}

export function formatarDuracao(segundos) {
  const n = Number(segundos);
  if (n >= 86400) {
    const d = n / 86400;
    return (Number.isInteger(d) ? d : d.toFixed(1)) + (d === 1 ? " dia" : " dias");
  }
  if (n >= 3600) {
    const h = Math.round(n / 3600);
    return h + (h === 1 ? " hora" : " horas");
  }
  const m = Math.max(1, Math.round(n / 60));
  return m + (m === 1 ? " minuto" : " minutos");
}

// "5 dias", "2 horas"... quanto falta até `fim`
export function restante(fim, agora) {
  const falta = Number(fim) - agora;
  if (falta <= 0) return "0 minuto";
  return formatarDuracao(falta);
}

// ---------------------------------------------------------------
// Conteúdo dos registros
// (provisório: o texto vai direto no contrato; com o IPFS, aqui entrará só o CID)
// Formato: JSON com texto, criterios, assunto, subassunto, uf, cidade.
// ---------------------------------------------------------------

export function montarConteudo(c) {
  const obj = { texto: c.texto.trim() };
  for (const campo of ["criterios", "assunto", "subassunto", "uf", "cidade"]) {
    const valor = (c[campo] || "").trim();
    if (valor) obj[campo] = valor;
  }
  return JSON.stringify(obj);
}

export function lerConteudo(bruto) {
  const vazio = { criterios: "", assunto: "", subassunto: "", uf: "", cidade: "" };
  try {
    const obj = JSON.parse(bruto);
    if (obj && typeof obj.texto === "string") {
      return {
        ...vazio,
        texto: obj.texto,
        criterios: obj.criterios || "",
        assunto: obj.assunto || "",
        subassunto: obj.subassunto || "",
        uf: obj.uf || "",
        cidade: obj.cidade || "",
      };
    }
  } catch {
    // texto simples
  }
  return { ...vazio, texto: bruto };
}

function lerFonte(cid) {
  try {
    const obj = JSON.parse(cid);
    if (obj && typeof obj.titulo === "string") return { titulo: obj.titulo, link: obj.link || "" };
  } catch {
    // texto simples
  }
  return { titulo: cid, link: "" };
}

// Ano de referência: o que aparece no texto "Válido para", senão o ano do registro
function anoDe(referencia, criadoEm) {
  const m = /(19|20)\d{2}/.exec(referencia || "");
  if (m) return Number(m[0]);
  return new Date(Number(criadoEm) * 1000).getFullYear();
}

// ---------------------------------------------------------------
// Situação de um registro (as cores das lombadas)
// ---------------------------------------------------------------

export function statusDoVeredito(r) {
  switch (r.resultado) {
    case 1:
    case 4:
      return "v";
    case 2:
    case 6:
      return "f";
    case 5:
      return "p";
    default:
      return "s";
  }
}

export function definitivo(r, agora) {
  return r.estado === 2 && (agora >= r.fimContestacao || r.rodada >= 3);
}

// Chave de ST (v, f, c, s, x, w, r, p)
export function statusDe(r, agora) {
  if (r.superadaPor > 0) return "x";
  if (r.estado === 0) return "r";
  if (r.estado === 1) return "w";
  if (r.estado === 3) return "s";
  if (agora < r.fimContestacao && r.rodada < 3) return "c";
  return statusDoVeredito(r);
}

export function rotuloStatus(r, agora) {
  const k = statusDe(r, agora);
  if (k === "v" || k === "f" || k === "p") return VEREDITOS[r.resultado];
  if (k === "s" && r.estado === 2) return VEREDITOS[r.resultado];
  return ST[k][0];
}

// ---------------------------------------------------------------
// Leitura do contrato
// ---------------------------------------------------------------

export async function carregarResumo(contrato, conta) {
  const [proximoId, revisoresAtivos, minRevisores, janelaVotacao, janelaContestacao, dono, euSouRevisor] =
    await Promise.all([
      contrato.proximoId(),
      contrato.revisoresAtivos(),
      contrato.minRevisores(),
      contrato.janelaVotacao(),
      contrato.janelaContestacao(),
      contrato.owner(),
      conta ? contrato.ehRevisor(conta) : Promise.resolve(false),
    ]);
  return {
    totalRegistros: Number(proximoId) - 1,
    revisoresAtivos: Number(revisoresAtivos),
    minRevisores: Number(minRevisores),
    janelaVotacao: Number(janelaVotacao),
    janelaContestacao: Number(janelaContestacao),
    dono,
    euSouRevisor,
    euSouDono: !!conta && dono.toLowerCase() === conta.toLowerCase(),
  };
}

// Lê todos os registros, já com o que a conta conectada pode fazer em cada um.
// Os mais novos vêm primeiro.
export async function carregarRegistros(contrato, conta) {
  const proximoId = Number(await contrato.proximoId());
  const ids = [];
  for (let id = 1; id < proximoId; id++) ids.push(id);

  let ehRevisor = false;
  let epocaRevisor = 0;
  if (conta) {
    const [rev, ep] = await Promise.all([contrato.ehRevisor(conta), contrato.revisorEpoca(conta)]);
    ehRevisor = rev;
    epocaRevisor = Number(ep);
  }
  const minha = conta ? conta.toLowerCase() : null;

  const lidos = await Promise.all(ids.map((id) => contrato.obterRegistro(id)));

  const completos = await Promise.all(
    lidos.map(async (r) => {
      const id = Number(r.id);
      const tipo = Number(r.tipo);
      const rodada = Number(r.rodada);
      const vs = VEREDITOS_DO_TIPO[tipo];

      const [contagens, meuVoto, autorJaContestou] = await Promise.all([
        Promise.all(vs.map((v) => contrato.obterContagem(id, rodada, v))),
        conta ? contrato.obterVoto(id, rodada, conta) : Promise.resolve(0n),
        contrato.autorJaContestou(id),
      ]);

      const contagem = vs.map((v, i) => ({ veredito: v, qtd: Number(contagens[i]) }));
      const euSouAutor = minha !== null && r.autor.toLowerCase() === minha;
      const epocaAbertura = Number(r.epocaAbertura);
      const meta = lerConteudo(r.cidConteudo);

      return {
        id,
        autor: r.autor,
        tipo,
        cidConteudo: r.cidConteudo,
        texto: meta.texto,
        criterios: meta.criterios,
        assunto: meta.assunto || "Outros",
        subassunto: meta.subassunto,
        uf: meta.uf,
        cidade: meta.cidade,
        prazo: Number(r.prazo),
        criadoEm: Number(r.criadoEm),
        estado: Number(r.estado),
        rodada,
        resultado: Number(r.resultado),
        totalRevisores: Number(r.totalRevisores),
        fimVotacao: Number(r.fimVotacao),
        finalizadoEm: Number(r.finalizadoEm),
        fimContestacao: Number(r.fimContestacao),
        referencia: r.referencia,
        ano: anoDe(r.referencia, r.criadoEm),
        substitui: Number(r.substitui),
        superadaPor: Number(r.superadaPor),
        contagem,
        totalVotos: contagem.reduce((soma, c) => soma + c.qtd, 0),
        meuVoto: Number(meuVoto),
        autorJaContestou,
        euSouAutor,
        euSouRevisor: ehRevisor,
        euPossoVotar: ehRevisor && epocaRevisor <= epocaAbertura && !euSouAutor,
      };
    })
  );

  return completos.reverse();
}

export async function carregarFontes(contrato, id) {
  const lista = await contrato.obterFontes(id);
  return lista.map((f) => ({
    ...lerFonte(f.cid),
    anexadaPor: f.anexadaPor,
    data: Number(f.data),
    rodada: Number(f.rodada),
  }));
}

// Revisores cadastrados, com desde quando e quantos votos já deram
export async function carregarRevisores(contrato, registros) {
  const lista = await contrato.obterRevisores();
  const itens = await Promise.all(
    lista.map(async (endereco) => {
      const [ativo, desde] = await Promise.all([contrato.ehRevisor(endereco), contrato.revisorDesde(endereco)]);
      const consultas = [];
      for (const r of registros) {
        for (let rod = 1; rod <= r.rodada; rod++) consultas.push(contrato.obterVoto(r.id, rod, endereco));
      }
      const votos = (await Promise.all(consultas)).filter((v) => Number(v) > 0).length;
      return { endereco, ativo, desde: Number(desde), votos };
    })
  );
  return itens.sort((a, b) => a.desde - b.desde);
}

// ---------------------------------------------------------------
// Escrita no contrato
// ---------------------------------------------------------------

export function mensagemDeErro(e) {
  if (e?.code === "ACTION_REJECTED" || e?.code === 4001) return "Você cancelou a transação na MetaMask.";
  if (e?.reason) return "O contrato recusou: " + e.reason;
  if (e?.shortMessage) return e.shortMessage;
  return "Algo deu errado. Veja o console (F12) para detalhes.";
}

export async function executar(contrato, nomeDaFuncao, argumentos = []) {
  const tx = await contrato[nomeDaFuncao](...argumentos);
  await tx.wait();
  return tx.hash;
}

// `dados`: tipo ("afirmacao" | "promessa"), texto, criterios, prazo (segundos), referencia,
// substitui (id ou 0), assunto, subassunto, uf, cidade
export async function enviarRegistro(contrato, dados) {
  const conteudo = montarConteudo(dados);
  if (dados.tipo === "afirmacao") {
    return executar(contrato, "registrarAfirmacao", [conteudo, dados.referencia.trim(), BigInt(dados.substitui || 0)]);
  }
  return executar(contrato, "registrarPromessa", [conteudo, hashTexto(dados.criterios.trim()), BigInt(dados.prazo)]);
}

// Fonte provisória: título + link guardados como texto (com o IPFS, aqui entrará o CID)
export async function anexarFonte(contrato, id, titulo, link) {
  const cid = JSON.stringify(link ? { titulo: titulo.trim(), link: link.trim() } : { titulo: titulo.trim() });
  return executar(contrato, "anexarFonte", [id, cid, hashTexto(cid)]);
}
