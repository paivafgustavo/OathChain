import { ST } from "./dados";
import { VEREDITOS, statusDe, rotuloStatus } from "./oathchain";

// Cores do veredito sobre o papel claro da página do registro
export const COR_PAPEL = {
  v: "#1f7a50", f: "#b3282d", c: "#8a5d00", s: "#5d5f66",
  x: "#4e3d82", w: "#2f6db0", r: "#6b6b75", p: "#a85a0f",
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
      style={{ "--h": h + "px", "--w": w + "px", "--c": `var(${ST[chave][1]})`, "--d": atraso + "ms" }}
      data-s={chave}
      onClick={() => irPara("registro/" + r.id)}
      aria-label={`${nome} (${r.ano}): ${rotuloStatus(r, agora)}`}
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

// Filtros por situação (as "pílulas")
export function Filtro({ valor, aoMudar }) {
  return (
    <div className="pills">
      <button aria-pressed={valor === "all"} onClick={() => aoMudar("all")}>
        Todos
      </button>
      {Object.entries(ST).map(([k, [nome, cor]]) => (
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
