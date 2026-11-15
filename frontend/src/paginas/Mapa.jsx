import { useMemo, useState } from "react";
import { ST } from "../dados";
import { MAP, CAP } from "../mapa-brasil";
import { Prateleira, Ir } from "../componentes";
import { statusDe } from "../oathchain";

const NM = (s) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export default function Mapa({ d }) {
  const [sel, setSel] = useState({ code: null, city: null });
  const [q, setQ] = useState("");
  const { registros, agora } = d;

  const contagem = useMemo(() => {
    const m = {};
    registros.forEach((r) => {
      if (r.uf) m[r.uf] = (m[r.uf] || 0) + 1;
    });
    return m;
  }, [registros]);
  const max = Math.max(1, ...Object.values(contagem));
  const semLocal = registros.filter((r) => !r.uf).length;

  const filtrados = registros.filter(
    (r) => (!sel.code || r.uf === sel.code) && (!sel.city || NM(r.cidade || "") === NM(sel.city))
  );
  const porStatus = Object.keys(ST).map((k) => ({ k, n: filtrados.filter((r) => statusDe(r, agora) === k).length }));
  const nome = sel.city ? `${sel.city} · ${sel.code}` : sel.code ? MAP[sel.code].n : "Brasil";

  function digitou(valor) {
    setQ(valor);
    const v = NM(valor);
    if (!v) return;
    const est = Object.entries(MAP).find(([k, m]) => NM(m.n) === v || k.toLowerCase() === v);
    if (est) return setSel({ code: est[0], city: null });
    const cap = Object.entries(CAP).find(([k]) => NM(k) === v);
    if (cap) setSel({ code: cap[1], city: cap[0] });
  }

  return (
    <>
      <h2>Procure por estado ou cidade</h2>
      <p className="mut" style={{ maxWidth: "62ch" }}>
        Clique num estado do mapa ou digite o nome de um estado ou de uma capital. Quanto mais clara a cor, mais registros.
      </p>
      <div className="search">
        <input list="dl" autoComplete="off" aria-label="Estado ou cidade" placeholder="Digite um estado ou cidade, ex.: Goiás ou Goiânia" value={q} onChange={(e) => digitou(e.target.value)} />
        <datalist id="dl">
          {Object.values(MAP).map((m) => <option key={m.n} value={m.n} />)}
          {Object.keys(CAP).map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      <div className="mapg">
        <div className="card mapw">
          <svg viewBox="0 0 423 435" role="group" aria-label="Mapa do Brasil por estados">
            {Object.entries(MAP).map(([c, m]) => {
              const n = contagem[c] || 0;
              const t = n / max;
              return (
                <path
                  key={c}
                  d={m.d}
                  className={sel.code === c ? "sel" : ""}
                  tabIndex={0}
                  role="button"
                  aria-label={`${m.n}: ${n} registros`}
                  style={{ fill: `hsl(40 ${30 + t * 45}% ${16 + t * 38}%)` }}
                  onClick={() => { setQ(m.n); setSel({ code: c, city: null }); }}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setQ(m.n); setSel({ code: c, city: null }); } }}
                >
                  <title>{m.n}: {n} registros</title>
                </path>
              );
            })}
          </svg>
          <div className="scale" />
          <small style={{ display: "flex", justifyContent: "space-between" }}>
            <span>Menos registros</span>
            <span>Mais registros</span>
          </small>
        </div>

        <div className="card">
          <small>{sel.city ? "Cidade" : sel.code ? "Estado" : "Visão geral"}</small>
          <h3 style={{ font: "600 32px Newsreader,serif", margin: "4px 0 10px" }}>{nome}</h3>
          <div className="stat">{filtrados.length}</div>
          <small>registros {sel.code ? "nesta região" : "no país todo"}</small>
          {filtrados.length > 0 && (
            <div className="sb">
              {porStatus.filter((p) => p.n > 0).map((p) => (
                <i key={p.k} style={{ flex: p.n, background: `var(${ST[p.k][1]})` }} />
              ))}
            </div>
          )}
          <div className="vl">
            {porStatus.filter((p) => p.n > 0).map((p) => (
              <span key={p.k}>
                <span>
                  <i style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, marginRight: 6, background: `var(${ST[p.k][1]})` }} />
                  {ST[p.k][0]}
                </span>
                <b>{p.n}</b>
              </span>
            ))}
          </div>
          <h3 style={{ marginTop: 8 }}>Estante de {sel.city || (sel.code ? MAP[sel.code].n : "todo o país")}</h3>
          <Prateleira registros={filtrados.slice(0, 12)} agora={agora} vazio="Nenhum registro nesta região ainda." />
          {filtrados[0] && (
            <div className="cta"><Ir className="main-btn" para={"registro/" + filtrados[0].id}>Abrir registro</Ir></div>
          )}
          {semLocal > 0 && <p className="mut" style={{ fontSize: 14 }}>{semLocal} registro(s) sem estado definido não aparecem no mapa.</p>}
        </div>
      </div>
    </>
  );
}
