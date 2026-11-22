import { ST } from "./dados";
import { VEREDITOS, statusDe, rotuloStatus } from "./oathchain";

// Cores do veredito sobre o papel claro da página do registro
export const COR_PAPEL = {
  v: "#1f7a50", f: "#b3282d", c: "#8a5d00", s: "#7a4e2c",
  x: "#4a505e", w: "#0e7490", r: "#6b7280", p: "#a3238a", i: "#6d28d9",
};

export const irPara = (rota) => {
  window.location.hash = rota;
};

export function Ir({ para, className, children }) {
  return (
    <button className={className} onClick={() => irPara(para)}>
      {children}
    </button>
  );
}

export function curto(texto, n = 32) {
  return texto.length > n ? texto.slice(0, n - 1).trimEnd() + "…" : texto;
}

// Uma lombada de livro = um registro
export function Livro({ r, agora, atraso = 0 }) {
  const chave = statusDe(r, agora);
  const h = 150 + ((r.id * 37) % 62);
  const w = 34 + ((r.id * 13) % 14);
  const nome = curto(r.texto, 34);
  return (
    <button
      className="bk"
      style={{ "--lh": h + "px", "--lw": w + "px", "--lc": `var(${ST[chave][1]})`, "--ld": atraso + "ms" }}
      data-s={chave}
      onClick={() => irPara("registro/" + r.id)}
      aria-label={`${nome} (${r.ano}): ${rotuloStatus(r, agora)}`}
      title={`${rotuloStatus(r, agora)}: ${r.texto}`}
    >
      {chave === "x" && <i className="seal" />}
      <span>
        {nome} · {r.ano}
      </span>
    </button>
  );
}

export function Prateleira({ registros, agora, vazio = "Nenhum registro aqui ainda." }) {
  return (
    <div className="row">
      {registros.length === 0 ? (
        <span className="livro-vazio">{vazio}</span>
      ) : (
        registros.map((r, i) => <Livro key={r.id} r={r} agora={agora} atraso={i * 40} />)
      )}
    </div>
  );
}

// Legenda das cores das lombadas: o que cada cor quer dizer
const LEGENDA = [
  ["v", "A afirmação é verdadeira ou a promessa foi cumprida"],
  ["f", "A afirmação é falsa ou a promessa não foi cumprida"],
  ["p", "A promessa foi cumprida só em parte"],
  ["w", "Um júri sorteado está julgando agora"],
  ["c", "Já tem veredito, mas ainda pode ser contestado"],
  ["i", "A IA deu um veredito provisório; ainda dá para recorrer"],
  ["r", "Esperando a análise dos agentes de IA"],
  ["s", "O júri não chegou a uma maioria"],
  ["x", "Corrigido por um registro mais novo (tem um selo dourado)"],
];

export function Legenda() {
  return (
    <details className="legenda" open>
      <summary>O que significa cada cor?</summary>
      <ul>
        {LEGENDA.map(([k, explica]) => (
          <li key={k}>
            <i style={{ background: `var(${ST[k][1]})` }} aria-hidden="true" />
            <span><b>{ST[k][0]}</b> <small>{explica}</small></span>
          </li>
        ))}
      </ul>
    </details>
  );
}

// Filtros por situação (as "pílulas")
// presentes (opcional): só as situações que aparecem nos registros; a escolhida sempre fica visível
export function Filtro({ valor, aoMudar, presentes }) {
  const itens = Object.entries(ST).filter(([k]) => !presentes || presentes.has(k) || k === valor);
  if (presentes && itens.length < 2 && valor === "all") return null;
  return (
    <div className="pills" aria-label="Filtrar por situação">
      <button aria-pressed={valor === "all"} onClick={() => aoMudar("all")}>
        Todos
      </button>
      {itens.map(([k, [nome, cor]]) => (
        <button key={k} aria-pressed={valor === k} onClick={() => aoMudar(k)}>
          <i style={{ background: `var(${cor})` }} />
          {nome}
        </button>
      ))}
    </div>
  );
}

// Barra de votos: o veredito mais votado contra o resto
export function BarraVotos({ contagem, totalRevisores }) {
  const votos = contagem.reduce((s, c) => s + c.qtd, 0);
  if (votos === 0) return <p className="nota-v">Ainda sem votos nesta rodada.</p>;
  const topo = contagem.reduce((a, b) => (b.qtd > a.qtd ? b : a));
  const pct = Math.round((topo.qtd / votos) * 100);
  const cor = { 1: "var(--v)", 4: "var(--v)", 2: "var(--f)", 6: "var(--f)", 5: "var(--p)", 3: "var(--s)" }[topo.veredito];
  return (
    <>
      <div className="vb" role="img" aria-label={`${topo.qtd} de ${votos} votaram ${VEREDITOS[topo.veredito]}`}>
        <b className="a" style={{ width: pct + "%", background: cor }}>
          <em>{pct}%</em> {VEREDITOS[topo.veredito]} <small style={{ color: "#fffc" }}>{topo.qtd} votos</small>
        </b>
        <b className="b" style={{ background: "#3a3a44" }}>
          {pct < 100 && <em>{100 - pct}%</em>}
        </b>
        <i className="mk">
          <u>50%</u>
        </i>
      </div>
      <p className="nota-v" style={{ color: "inherit" }}>
        {votos} de {totalRevisores} revisores votaram.
      </p>
    </>
  );
}

export function Aviso({ tipo, children }) {
  return <div className={"aviso " + (tipo || "")}>{children}</div>;
}
