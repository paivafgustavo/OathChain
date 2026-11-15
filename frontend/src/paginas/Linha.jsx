import { useState } from "react";
import { ST, T, SUB, ASSUNTOS } from "../dados";
import { Ir, curto, irPara } from "../componentes";
import { statusDe, rotuloStatus } from "../oathchain";

const mesAno = (seg) => new Date(seg * 1000).toLocaleDateString("pt-BR", { month: "short", year: "numeric" });

export default function Linha({ d }) {
  const { registros, agora } = d;
  // Assunto inicial: o que tem mais registros
  const maisCheio = [...ASSUNTOS, "Outros"].sort(
    (a, b) => registros.filter((r) => r.assunto === b).length - registros.filter((r) => r.assunto === a).length
  )[0];
  const [assunto, setAssunto] = useState(null);
  const [tema, setTema] = useState("");
  const atual = assunto ?? maisCheio;

  const itens = registros
    .filter((r) => r.assunto === atual && (!tema || r.subassunto === tema))
    .sort((a, b) => a.criadoEm - b.criadoEm);

  return (
    <>
      <h2>Como a verdade mudou em {atual}</h2>
      <p className="mut" style={{ maxWidth: "60ch" }}>
        Do mais antigo ao mais novo. Quando um dado muda, o registro velho não some: ele vira Superado e o novo toma o lugar.
      </p>
      <div className="f" style={{ marginBottom: 14, maxWidth: 520 }}>
        <div className="linha2">
          <label>Assunto
            <select value={atual} onChange={(e) => { setAssunto(e.target.value); setTema(""); }}>
              {[...ASSUNTOS, "Outros"].map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <label>Tema
            <select value={tema} onChange={(e) => setTema(e.target.value)}>
              <option value="">Todos</option>
              {SUB[atual].map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <div className="tl" tabIndex={0} aria-label="Linha do tempo, role para o lado">
          {itens.length === 0 ? (
            <p className="mut" style={{ padding: 20 }}>Nenhum registro neste assunto ainda.</p>
          ) : (
            <ol>
              {itens.map((r, i) => {
                const k = statusDe(r, agora);
                return (
                  <li key={r.id}>
                    <button
                      className="bk"
                      style={{ "--h": 130 + ((r.id * 37) % 62) + "px", "--w": "46px", "--c": `var(${ST[k][1]})`, "--d": i * 90 + "ms" }}
                      onClick={() => irPara("registro/" + r.id)}
                      aria-label={`${curto(r.texto, 40)}, ${rotuloStatus(r, agora)}`}
                    >
                      {k === "x" && <i className="seal" />}
                    </button>
                    <time>{mesAno(r.criadoEm)}</time>
                    <p>
                      <b style={{ color: "var(--text)" }}>{curto(r.texto, 60)}</b>
                      <br />
                      {rotuloStatus(r, agora)}
                      {k === "x" && <><br />substituído pelo #{r.superadaPor}</>}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </div>
      <div className="cta"><Ir className="main-btn" para="assuntos">Explorar os assuntos</Ir></div>
    </>
  );
}
