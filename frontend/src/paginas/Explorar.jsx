// Explorar: tudo o que foi registrado, em 5 formas de ver (antes eram 5 páginas no menu).
import { useState } from "react";
import { ST, ASSUNTOS } from "../dados";
import { Prateleira, Filtro, irPara } from "../componentes";
import { statusDe, rotuloStatus, formatarDia } from "../oathchain";
import { SO_REVISOR_REGISTRA } from "../config";
import Cena from "../Cena";
import { Hub } from "./Assuntos";
import Mapa from "./Mapa";

const ABAS = [
  ["lista", "Lista"],
  ["estante", "Estante"],
  ["assuntos", "Assuntos"],
  ["mapa", "Mapa"],
  ["linha", "Linha do tempo"],
];
const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export default function Explorar({ d, aba: aba0 = "lista", q0 = "" }) {
  const [aba, setAba] = useState(ABAS.some(([k]) => k === aba0) ? aba0 : "lista");
  const [q, setQ] = useState(q0);
  const [filtro, setFiltro] = useState("all");
  const { registros, agora } = d;

  // Troca de aba sem recarregar a página (a busca digitada continua lá); o endereço acompanha
  function trocar(k) {
    setAba(k);
    window.history.replaceState(null, "", "#explorar/" + k);
  }

  const palavras = norm(q).split(/\s+/).filter((p) => p.length > 2);
  const filtrados = registros.filter(
    (r) =>
      (palavras.length === 0 || palavras.every((p) => norm(r.texto + " " + r.assunto + " " + (r.cidade || "")).includes(p))) &&
      (filtro === "all" || statusDe(r, agora) === filtro)
  );
  const podeRegistrar = d.conta && d.redeCorreta && (!SO_REVISOR_REGISTRA || d.euSouRevisor);
  const assuntos = [...ASSUNTOS, ...(registros.some((r) => r.assunto === "Outros") ? ["Outros"] : [])];

  return (
    <>
      <div className="exp-topo">
        <div>
          <h1>Explorar</h1>
          <p className="mut" style={{ margin: "6px 0 0" }}>Tudo o que já foi registrado e verificado, do jeito que fizer mais sentido para você.</p>
        </div>
        {podeRegistrar && (
          <button className="main-btn" onClick={() => irPara("registrar/" + encodeURIComponent(q))}>
            <span aria-hidden="true">+</span> Registrar afirmação
          </button>
        )}
      </div>

      <label className="busca">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
        </svg>
        <span className="so-leitor">Buscar uma afirmação</span>
        <input
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); if (aba === "assuntos" || aba === "mapa") trocar("lista"); }}
          placeholder="Busque uma afirmação, assunto ou cidade. Ex.: inflação, desmatamento"
        />
      </label>

      <div className="exp-barra">
        <div className="abas" role="tablist" aria-label="Formas de ver">
          {ABAS.map(([k, nome]) => (
            <button key={k} role="tab" aria-selected={aba === k} onClick={() => trocar(k)}>{nome}</button>
          ))}
        </div>
        {(aba === "lista" || aba === "estante" || aba === "linha") && <Filtro valor={filtro} aoMudar={setFiltro} presentes={new Set(registros.map((r) => statusDe(r, agora)))} />}
      </div>

      <div key={aba} className="aba-vista" role="tabpanel">
        {aba === "lista" && (
          <>
            <p className="mut" style={{ margin: "0 0 14px", fontSize: 14 }}>
              {d.carregando && registros.length === 0 ? "Lendo os registros…" : `${filtrados.length} ${filtrados.length === 1 ? "registro" : "registros"}`}
            </p>
            <div className="grade-reg">
              {filtrados.map((r, i) => {
                const k = statusDe(r, agora);
                return (
                  <button key={r.id} className="cartao-reg inclina" style={{ animationDelay: Math.min(i, 12) * 40 + "ms" }} onClick={() => irPara("registro/" + r.id)}>
                    <span className="cr-topo"><span>{r.assunto}</span><span>{r.referencia || formatarDia(r.criadoEm)}</span></span>
                    <span className="cr-texto">{r.texto}</span>
                    <span className="cr-pe">
                      <span className="selo-st" style={{ "--cor": `var(${ST[k][1]})` }}>{rotuloStatus(r, agora)}</span>
                      <span className="mut">#{r.id}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            {q.trim() && filtrados.length === 0 && (
              <div className="card vazio">
                <b>Ainda não verificada.</b>{" "}
                <span className="mut">
                  {podeRegistrar
                    ? "Nenhum registro parecido. Você pode registrar esta afirmação."
                    : SO_REVISOR_REGISTRA ? "Nenhum registro parecido. Só revisores registram afirmações novas: veja em Participar como virar revisor." : "Conecte sua carteira para registrar esta afirmação."}
                </span>
                {podeRegistrar && (
                  <div style={{ marginTop: 14 }}>
                    <button className="main-btn" onClick={() => irPara("registrar/" + encodeURIComponent(q))}>Registrar esta afirmação</button>
                  </div>
                )}
              </div>
            )}
            {!q.trim() && !d.carregando && registros.length === 0 && <div className="card vazio">Ainda não há registros. O primeiro pode ser o seu.</div>}
          </>
        )}

        {aba === "estante" &&
          assuntos.map((a) => {
            const lista = filtrados.filter((r) => r.assunto === a);
            return (
              <section className="estante" key={a}>
                <button className="estante-tit" onClick={() => irPara("assunto/" + encodeURIComponent(a))}>
                  {a} <span aria-hidden="true">›</span>
                </button>
                <div className="estante-moldura">
                  <div className="estante-fundo"><Cena tema={a} /></div>
                  <Prateleira registros={lista} agora={agora} vazio="Nenhum registro neste assunto ainda." />
                </div>
              </section>
            );
          })}

        {aba === "assuntos" && <Hub d={d} />}
        {aba === "mapa" && <Mapa d={d} />}
        {aba === "linha" && (
          <>
            {/* Linha do tempo vertical: do registro mais novo ao mais antigo, com a cor da situação */}
            <ol className="linha-v">
              {[...filtrados].sort((a, b) => b.criadoEm - a.criadoEm).map((r, i) => {
                const k = statusDe(r, agora);
                return (
                  <li key={r.id} style={{ "--cor": `var(${ST[k][1]})`, animationDelay: Math.min(i, 12) * 50 + "ms" }}>
                    <span className="linha-marca" aria-hidden="true" />
                    <p className="linha-quando">{r.referencia || formatarDia(r.criadoEm)} · {r.assunto}</p>
                    <button className="linha-texto" onClick={() => irPara("registro/" + r.id)}>{r.texto}</button>
                    <span className="selo-st">{rotuloStatus(r, agora)}</span>
                  </li>
                );
              })}
            </ol>
            {filtrados.length === 0 && <div className="card vazio">{q.trim() ? "Nenhum registro encontrado com essa busca." : "Ainda não há registros."}</div>}
          </>
        )}
      </div>
    </>
  );
}

