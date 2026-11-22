import { useState } from "react";
import { T, SUB } from "../dados";
import { Prateleira, Filtro, Legenda, irPara } from "../componentes";
import { statusDe } from "../oathchain";
import Cena from "../Cena";
import { useMovimentoReduzido } from "../movimento";

const pvDe = (registros, a) => {
  const fin = registros.filter((r) => r.assunto === a && r.estado === 2);
  if (fin.length === 0) return null;
  return Math.round((fin.filter((r) => r.resultado === 1 || r.resultado === 4).length / fin.length) * 100);
};

// Sala de um assunto: a cena grande no topo e a prateleira com a mesma cena na parede
export function Sala({ d, nome }) {
  const [filtro, setFiltro] = useState("all");
  const [sub, setSub] = useState("");
  const parado = useMovimentoReduzido();
  const assunto = T[nome] ? nome : "Outros";
  const t = T[assunto];

  const todos = d.registros.filter((r) => r.assunto === assunto);
  const lista = todos.filter((r) => (filtro === "all" || statusDe(r, d.agora) === filtro) && (!sub || r.subassunto === sub));
  const pv = pvDe(d.registros, assunto);
  const linhas = [];
  for (let i = 0; i < Math.max(lista.length, 1); i += 10) linhas.push(lista.slice(i, i + 10));

  return (
    <>
      <button className="voltar" onClick={() => irPara("explorar/estante")}>
        <span aria-hidden="true">←</span> Voltar à estante
      </button>

      <section className="sala-ban">
        <Cena tema={assunto} />
        <div className="sala-ban-txt">
          <p className="etq">Assunto</p>
          <h1>{assunto}</h1>
          <p>{t.k}</p>
          <p className="sala-ct">
            {todos.length} {todos.length === 1 ? "registro" : "registros"} · {pv === null ? "sem vereditos ainda" : pv + "% Verdadeiros"}
          </p>
        </div>
      </section>

      <div className="subtemas" aria-label="Subtemas">
        <button aria-pressed={!sub} onClick={() => setSub("")}>Todos</button>
        {(SUB[assunto] || []).map((s) => (
          <button key={s} aria-pressed={sub === s} onClick={() => setSub(sub === s ? "" : s)}>{s}</button>
        ))}
      </div>
      <Filtro valor={filtro} aoMudar={setFiltro} presentes={new Set(todos.map((r) => statusDe(r, d.agora)))} />

      <h2 className="sala-sub">A prateleira de {assunto}</h2>
      <Legenda />
      {linhas.map((l, i) => (
        <div className="estante-moldura grande" key={i}>
          <div className="estante-fundo"><Cena tema={assunto} /></div>
          {assunto === "Meio Ambiente" && !parado && (
            <>
              <span className="folha" style={{ left: "18%", background: "#3FA86F" }} />
              <span className="folha" style={{ left: "46%", background: "#2E8B5E", animationDelay: "-3s" }} />
              <span className="folha" style={{ left: "74%", background: "#DAA14E", animationDelay: "-6s" }} />
            </>
          )}
          <Prateleira registros={l} agora={d.agora} vazio="Nenhum registro aqui ainda." />
        </div>
      ))}
      <p className="mut" style={{ fontSize: 14, marginTop: 12 }}>Passe o mouse num livro para puxá-lo da prateleira. Clique para abrir o registro.</p>
    </>
  );
}
