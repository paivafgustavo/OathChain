import { useState } from "react";
import { ST } from "../dados";
import { Ir, irPara } from "../componentes";
import { statusDe, rotuloStatus, formatarDia } from "../oathchain";
import { SO_REVISOR_REGISTRA } from "../config";

const norm = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export default function Verificar({ d, q0 }) {
  const [q, setQ] = useState(q0 || "");
  const [aplicada, setAplicada] = useState(q0 || "");
  const { registros, agora } = d;

  const palavras = norm(aplicada).split(/\s+/).filter((p) => p.length > 2);
  const resultados = aplicada.trim()
    ? registros.filter((r) => palavras.every((p) => norm(r.texto).includes(p)))
    : registros.slice(0, 8);

  const podeRegistrar = d.conta && d.redeCorreta && (!SO_REVISOR_REGISTRA || d.euSouRevisor);

  return (
    <>
      <h2>Esta afirmação já foi verificada?</h2>
      <form
        className="search"
        onSubmit={(e) => {
          e.preventDefault();
          setAplicada(q);
        }}
      >
        <input aria-label="Afirmação" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Escreva ou cole a afirmação" />
        <button className="wallet" type="submit">Pesquisar</button>
      </form>

      {resultados.map((r, i) => {
        const k = statusDe(r, agora);
        return (
          <button key={r.id} className={"res" + (i === 0 && aplicada.trim() ? " big" : "")} onClick={() => irPara("registro/" + r.id)}>
            <span className="sp" style={{ background: `var(${ST[k][1]})` }} />
            <span>
              <b>{r.texto}</b>
              <small>
                {rotuloStatus(r, agora)} · válido para {r.referencia || "—"} · registrado em {formatarDia(r.criadoEm)}
              </small>
            </span>
          </button>
        );
      })}

      {aplicada.trim() && resultados.length === 0 && (
        <div className="card">
          <b>Ainda não verificada.</b>{" "}
          <small>
            {podeRegistrar
              ? "Nenhum registro parecido foi encontrado. Você pode registrar esta afirmação."
              : SO_REVISOR_REGISTRA
              ? "Só revisores cadastrados registram afirmações novas."
              : "Conecte sua carteira para registrar esta afirmação."}
          </small>
        </div>
      )}

      <div className="card" style={{ marginTop: 14 }}>
        <b>Não achou o que procurava?</b>{" "}
        <small>
          {SO_REVISOR_REGISTRA
            ? "Revisores cadastrados veem aqui o botão “Registrar esta afirmação”."
            : "Qualquer carteira conectada pode registrar uma afirmação ou promessa nova."}
        </small>
        {podeRegistrar && (
          <div className="cta">
            <Ir className="main-btn" para={"registrar/" + encodeURIComponent(aplicada)}>
              Registrar esta afirmação
            </Ir>
          </div>
        )}
      </div>
    </>
  );
}
