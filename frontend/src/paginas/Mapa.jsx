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

  const nacional = sel.code === "BR"; // "Brasil (nacional)": registros sem estado definido
  const filtrados = registros.filter((r) =>
    nacional ? !r.uf : (!sel.code || r.uf === sel.code) && (!sel.city || NM(r.cidade || "") === NM(sel.city))
  );
  const porStatus = Object.keys(ST).map((k) => ({ k, n: filtrados.filter((r) => statusDe(r, agora) === k).length }));
  const nome = nacional ? "Brasil (nacional)" : sel.city ? `${sel.city} · ${sel.code}` : sel.code ? MAP[sel.code].n : "Todo o país";
  const escolherBrasil = () => { setQ(""); setSel({ code: "BR", city: null }); };
  const verTudo = () => { setQ(""); setSel({ code: null, city: null }); };

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
        Clique num estado, digite um estado ou uma capital, ou veja as notícias nacionais. Quanto mais dourado, mais registros.
      </p>
      <div className="search">
        <input list="dl" autoComplete="off" aria-label="Estado ou cidade" placeholder="Digite um estado ou cidade, ex.: Goiás ou Goiânia" value={q} onChange={(e) => digitou(e.target.value)} />
        <datalist id="dl">
          {Object.values(MAP).map((m) => <option key={m.n} value={m.n} />)}
          {Object.keys(CAP).map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>

      <div className="map-esc" aria-label="Abrangência">
        <button aria-pressed={!sel.code} onClick={verTudo}>Todo o país</button>
        <button aria-pressed={nacional} onClick={escolherBrasil}>Brasil (nacional) · {semLocal}</button>
      </div>

      <div className="mapg">
        <div className="card mapw">
          <svg viewBox="0 0 423 435" role="group" aria-label="Mapa do Brasil por estados" className={nacional ? "pais-sel" : undefined}>
            {/* o estado escolhido é desenhado por último, para a borda dourada ficar inteira por cima dos vizinhos */}
            {Object.entries(MAP).sort(([a], [b]) => (a === sel.code) - (b === sel.code)).map(([c, m]) => {
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
                  style={{ fill: n === 0 ? "#1E3260" : `hsl(38 ${45 + t * 30}% ${32 + t * 24}%)` }}
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
          <small>{nacional ? "Abrangência nacional" : sel.city ? "Cidade" : sel.code ? "Estado" : "Visão geral"}</small>
          <h3 style={{ font: "600 32px Sora,sans-serif", margin: "4px 0 10px" }}>{nome}</h3>
          <div className="stat">{filtrados.length}</div>
          <small>registros {nacional ? "sobre o Brasil como um todo" : sel.code ? "nesta região" : "no país todo"}</small>
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
          <h3 style={{ marginTop: 8 }}>Estante de {nacional ? "notícias nacionais" : sel.city || (sel.code ? MAP[sel.code].n : "todo o país")}</h3>
          <Prateleira registros={filtrados.slice(0, 12)} agora={agora} vazio="Nenhum registro nesta região ainda." />
          {filtrados[0] && (
            <div className="cta"><Ir className="main-btn" para={"registro/" + filtrados[0].id}>Abrir registro</Ir></div>
          )}
          {semLocal > 0 && !nacional && (
            <p className="mut" style={{ fontSize: 14 }}>
              {semLocal} {semLocal === 1 ? "registro nacional" : "registros nacionais"} (sem estado) não {semLocal === 1 ? "aparece" : "aparecem"} no mapa.{" "}
              <button className="lk-btn" onClick={escolherBrasil}>Ver notícias nacionais</button>
            </p>
          )}
        </div>
      </div>
    </>
  );
}
