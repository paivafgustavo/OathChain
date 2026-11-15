import { useState } from "react";
import { ST, T, ASSUNTOS } from "../dados";
import { Prateleira, Filtro, BarraVotos, Ir, curto, irPara } from "../componentes";
import { VEREDITOS, statusDe, rotuloStatus, definitivo, restante } from "../oathchain";

const horaCurta = (seg) => {
  const d = new Date(seg * 1000);
  const hoje = new Date();
  return d.toDateString() === hoje.toDateString()
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
};

export default function Estante({ d }) {
  const [filtro, setFiltro] = useState("all");
  const [ate, setAte] = useState(null);
  const [busca, setBusca] = useState("");
  const { registros, agora } = d;

  const anos = registros.map((r) => r.ano);
  const anoMin = anos.length ? Math.min(...anos) : new Date().getFullYear();
  const anoMax = anos.length ? Math.max(...anos) : anoMin;
  const limite = Math.min(ate ?? anoMax, anoMax);

  const ult = registros[0];
  const chaveUlt = ult ? statusDe(ult, agora) : null;

  // Panorama
  const total = registros.length;
  const defs = registros.filter((r) => definitivo(r, agora)).length;
  const emContestacao = registros.filter((r) => statusDe(r, agora) === "c").length;
  const superados = registros.filter((r) => r.superadaPor > 0).length;
  const semConsenso = registros.filter((r) => r.estado === 3).length;

  // Registros por mês (últimos 7 meses) para o gráfico
  const meses = Array.from({ length: 7 }, (_, i) => {
    const ref = new Date();
    ref.setDate(1);
    ref.setMonth(ref.getMonth() - (6 - i));
    return registros.filter((r) => {
      const c = new Date(r.criadoEm * 1000);
      return c.getFullYear() === ref.getFullYear() && c.getMonth() === ref.getMonth();
    }).length;
  });
  const maxMes = Math.max(1, ...meses);
  const pontos = meses.map((n, i) => `${(i * 200) / 6},${52 - (n / maxMes) * 44}`).join(" ");

  const assuntos = [...ASSUNTOS, ...(registros.some((r) => r.assunto === "Outros") ? ["Outros"] : [])];
  const pvDe = (a) => {
    const fin = registros.filter((r) => r.assunto === a && r.estado === 2);
    if (fin.length === 0) return null;
    return Math.round((fin.filter((r) => r.resultado === 1 || r.resultado === 4).length / fin.length) * 100);
  };

  // Últimas atualizações, a partir dos próprios registros
  const eventos = registros
    .flatMap((r) => [
      { t: r.criadoEm, txt: `“${curto(r.texto, 40)}” foi registrado`, id: r.id },
      ...(r.finalizadoEm ? [{ t: r.finalizadoEm, txt: `“${curto(r.texto, 40)}” recebeu veredito: ${VEREDITOS[r.resultado]}`, id: r.id }] : []),
    ])
    .sort((a, b) => b.t - a.t)
    .slice(0, 5);

  return (
    <>
      <div className="card hero">
        <h1>Toda afirmação verificada fica guardada para sempre.</h1>
        <form
          className="search"
          onSubmit={(e) => {
            e.preventDefault();
            irPara("verificar/" + encodeURIComponent(busca));
          }}
        >
          <input
            aria-label="Pesquisar uma afirmação"
            placeholder="Cole aqui uma notícia ou dado para conferir"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
          />
          <button className="main-btn" type="submit">
            Verificar uma afirmação
          </button>
          <Ir className="wallet" para="mapa">
            Por estado ou cidade
          </Ir>
        </form>

        {ult ? (
          <>
            <small>
              Último registro, {ult.assunto} · válido para {ult.referencia || "—"} ·{" "}
              {chaveUlt === "c" ? `Em contestação, faltam ${restante(ult.fimContestacao, agora)}` : rotuloStatus(ult, agora)}
            </small>
            <div className="lab">
              “{ult.texto}” {ult.estado === 2 ? "é" : "está"}{" "}
              <b style={{ color: `var(${ST[chaveUlt][1]})` }}>
                {ult.estado === 2 ? VEREDITOS[ult.resultado] : ST[chaveUlt][0]}
              </b>
            </div>
            <BarraVotos contagem={ult.contagem} totalRevisores={ult.totalRevisores} />
          </>
        ) : (
          <p className="mut">
            {d.carregando ? "Lendo os registros…" : "Ainda não há registros. O primeiro pode ser o seu."}
          </p>
        )}
      </div>

      <div className="g">
        <div className="col">
          <div className="card">
            <h3>Panorama</h3>
            <div className="stat">{total}</div>
            <small>registros guardados</small>
            <svg viewBox="0 0 200 60" width="100%" style={{ margin: "14px 0" }} role="img" aria-label="Registros por mês">
              <polyline points={pontos} fill="none" stroke="#c9a24b" strokeWidth="2.5" />
            </svg>
            <p style={{ margin: "0 0 6px" }}><b>{total ? Math.round((defs / total) * 100) : 0}%</b> já são definitivos</p>
            <p style={{ margin: "0 0 6px" }}><b>{emContestacao}</b> em contestação agora</p>
            <p style={{ margin: "0 0 6px" }}><b>{superados}</b> superados</p>
            <p style={{ margin: 0 }}><b>{semConsenso}</b> sem consenso</p>
          </div>
          <div className="card">
            <h3>Por assunto</h3>
            {assuntos.map((a) => {
              const pv = pvDe(a);
              return (
                <button key={a} className="rg" onClick={() => irPara("assunto/" + encodeURIComponent(a))}>
                  <span>{T[a].e}</span>
                  <b>{a}</b>
                  <span className="mb"><i style={{ width: (pv ?? 0) + "%" }} /></span>
                  <small>{pv === null ? "—" : pv + "%"}</small>
                </button>
              );
            })}
            <small>% de registros Verdadeiros</small>
          </div>
        </div>

        <div className="card">
          <Filtro valor={filtro} aoMudar={setFiltro} />
          {assuntos.map((a) => {
            const lista = registros.filter(
              (r) => r.assunto === a && r.ano <= limite && (filtro === "all" || statusDe(r, agora) === filtro)
            );
            return (
              <div className="shelf" key={a}>
                <h3>
                  <button className="lk" onClick={() => irPara("assunto/" + encodeURIComponent(a))}>
                    {T[a].e} {a} <span>›</span>
                  </button>
                </h3>
                <Prateleira registros={lista} agora={agora} vazio="Nenhum registro neste assunto ainda." />
              </div>
            );
          })}
        </div>

        <div className="col">
          <div className="card">
            <h3>Últimas atualizações</h3>
            {eventos.length === 0 && <small>Nada por aqui ainda.</small>}
            {eventos.map((e, i) => (
              <div className="up" key={i}>
                <time>{horaCurta(e.t)}</time>
                <span>{e.txt}</span>
              </div>
            ))}
          </div>
          <div className="card lg" style={{ display: "block" }}>
            <h3>Legenda</h3>
            <div style={{ display: "grid", gap: 6 }}>
              {Object.values(ST).map(([n, c]) => (
                <span className="lg" style={{ margin: 0 }} key={n}>
                  <i style={{ background: `var(${c})` }} />
                  {n}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="card sl">
        <b>Linha do tempo</b>
        <input
          type="range"
          min={anoMin}
          max={anoMax}
          value={limite}
          disabled={anoMin === anoMax}
          onChange={(e) => setAte(+e.target.value)}
          aria-label="Mostrar registros até o ano"
        />
        <output>até {limite}</output>
        <span className="live">{d.carregando ? "● Atualizando…" : "● Atualizado"}</span>
      </div>
    </>
  );
}
