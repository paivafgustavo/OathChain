import { useEffect, useState } from "react";
import { T, ASSUNTOS } from "../dados";
import { Prateleira, Filtro, Ir, irPara } from "../componentes";
import { statusDe } from "../oathchain";

const pvDe = (registros, a) => {
  const fin = registros.filter((r) => r.assunto === a && r.estado === 2);
  if (fin.length === 0) return null;
  return Math.round((fin.filter((r) => r.resultado === 1 || r.resultado === 4).length / fin.length) * 100);
};

export function Hub({ d }) {
  const lista = [...ASSUNTOS, ...(d.registros.some((r) => r.assunto === "Outros") ? ["Outros"] : [])];
  return (
    <>
      <h2>Assuntos</h2>
      <p className="mut">Cada assunto tem a sua própria sala. Escolha um para entrar.</p>
      <div className="hub">
        {lista.map((k) => {
          const t = T[k];
          const n = d.registros.filter((r) => r.assunto === k).length;
          return (
            <button key={k} className="hubc" onClick={() => irPara("assunto/" + encodeURIComponent(k))}
              style={{ "--acc": t.a, "--pat": t.p, "--g": t.g }}>
              <span className="e2">{t.e}</span>
              <b>{k}</b>
              <small style={{ color: "#ffffffbb" }}>{t.k}</small>
              <small style={{ color: t.a }}>{n} {n === 1 ? "registro" : "registros"}</small>
            </button>
          );
        })}
      </div>
      <Ir className="main-btn" para="estante">Voltar à estante</Ir>
    </>
  );
}

export function Sala({ d, nome }) {
  const [filtro, setFiltro] = useState("all");
  const assunto = T[nome] ? nome : "Outros";
  const t = T[assunto];

  // Cada sala tem o seu tom de fundo
  useEffect(() => {
    document.body.style.setProperty("--tint", t.t);
    return () => document.body.style.removeProperty("--tint");
  }, [assunto]);

  const todos = d.registros.filter((r) => r.assunto === assunto);
  const lista = todos.filter((r) => filtro === "all" || statusDe(r, d.agora) === filtro);
  const pv = pvDe(d.registros, assunto);
  const linhas = [];
  for (let i = 0; i < Math.max(lista.length, 1); i += 10) linhas.push(lista.slice(i, i + 10));

  return (
    <div style={{ "--acc": t.a, "--board": t.b, "--pat": t.p, "--g": t.g }}>
      <div className="ban">
        <h2>{assunto}</h2>
        <p>{t.k}</p>
        <div className="ct">{todos.length} {todos.length === 1 ? "registro" : "registros"} · {pv === null ? "sem vereditos ainda" : pv + "% Verdadeiros"}</div>
        <div dangerouslySetInnerHTML={{ __html: t.d }} />
      </div>
      <div className="card">
        <Filtro valor={filtro} aoMudar={setFiltro} />
        <div className="row-wrap">
          {linhas.map((l, i) => (
            <div className="shelf" key={i}>
              <Prateleira registros={l} agora={d.agora} vazio="Nenhum registro aqui ainda." />
            </div>
          ))}
        </div>
      </div>
      <div className="cta">
        <Ir className="main-btn" para="assuntos">Ver outros assuntos</Ir>{" "}
        <Ir className="wallet" para="estante">Voltar à estante</Ir>
      </div>
    </div>
  );
}
