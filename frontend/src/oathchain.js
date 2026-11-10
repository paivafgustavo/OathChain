// Funções de apoio: nomes legíveis, leitura e envio de dados do contrato.
import { id as hashTexto } from "ethers";

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

// "0x1234...abcd"
export function abreviar(endereco) {
  if (!endereco) return "";
  return endereco.slice(0, 6) + "…" + endereco.slice(-4);
}

// Converte um timestamp (segundos) em data legível. 0 vira "—".
export function formatarData(segundos) {
  const n = Number(segundos);
  if (!n) return "—";
  return new Date(n * 1000).toLocaleString("pt-BR");
}

// Lê os números gerais do contrato.
export async function carregarResumo(contrato) {
  const [proximoId, revisoresAtivos, minRevisores, janelaVotacao, dono] = await Promise.all([
    contrato.proximoId(),
    contrato.revisoresAtivos(),
    contrato.minRevisores(),
    contrato.janelaVotacao(),
    contrato.owner(),
  ]);
  return {
    totalRegistros: Number(proximoId) - 1,
    revisoresAtivos: Number(revisoresAtivos),
    minRevisores: Number(minRevisores),
    janelaDias: Number(janelaVotacao) / 86400,
    dono,
  };
}

// Vereditos que cada tipo aceita (números do enum do contrato)
export const VEREDITOS_DO_TIPO = [
  [1, 2, 3], // Afirmação: Verdadeira, Falsa, Inconclusiva
  [4, 5, 6], // Promessa: Cumprida, Parcialmente cumprida, Não cumprida
];

// Lê todos os registros, já com o que a conta conectada pode fazer em cada um.
// Os mais novos vêm primeiro.
export async function carregarRegistros(contrato, conta) {
  const proximoId = Number(await contrato.proximoId());
  const ids = [];
  for (let id = 1; id < proximoId; id++) ids.push(id);

  // Informações sobre a conta conectada
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

      return {
        id,
        autor: r.autor,
        tipo,
        cidConteudo: r.cidConteudo,
        prazo: Number(r.prazo),
        criadoEm: Number(r.criadoEm),
        estado: Number(r.estado),
        rodada,
        resultado: Number(r.resultado),
        totalRevisores: Number(r.totalRevisores),
        fimVotacao: Number(r.fimVotacao),
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

// Executa uma ação do contrato (abrirVerificacao, votar, finalizar, contestar...)
// e espera a confirmação na rede. Devolve o hash da transação.
export async function executar(contrato, nomeDaFuncao, argumentos = []) {
  const tx = await contrato[nomeDaFuncao](...argumentos);
  await tx.wait();
  return tx.hash;
}

// ---------------------------------------------------------------
// Conteúdo dos registros
// (provisório: o texto vai direto no contrato; com o IPFS, aqui entrará só o CID)
// ---------------------------------------------------------------

// Promessa guarda texto + critérios em JSON; afirmação guarda só o texto.
export function lerConteudo(bruto) {
  try {
    const obj = JSON.parse(bruto);
    if (obj && typeof obj.texto === "string") {
      return { texto: obj.texto, criterios: obj.criterios || "" };
    }
  } catch {
    // não é JSON: é texto simples
  }
  return { texto: bruto, criterios: "" };
}

// Traduz erros técnicos em mensagens que a pessoa entende.
export function mensagemDeErro(e) {
  if (e?.code === "ACTION_REJECTED" || e?.code === 4001) {
    return "Você cancelou a transação na MetaMask.";
  }
  if (e?.reason) return "O contrato recusou: " + e.reason;
  if (e?.shortMessage) return e.shortMessage;
  return "Algo deu errado. Veja o console (F12) para detalhes.";
}

// Envia um novo registro. `dados` = { tipo: "afirmacao" | "promessa", texto, criterios, prazo }
// `prazo` é um timestamp em segundos (só para promessa).
export async function enviarRegistro(contrato, dados) {
  const texto = dados.texto.trim();
  let tx;
  if (dados.tipo === "afirmacao") {
    tx = await contrato.registrarAfirmacao(texto);
  } else {
    const criterios = dados.criterios.trim();
    const conteudo = JSON.stringify({ texto, criterios });
    tx = await contrato.registrarPromessa(conteudo, hashTexto(criterios), BigInt(dados.prazo));
  }
  await tx.wait(); // espera a confirmação na rede
  return tx.hash;
}
