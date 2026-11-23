import { useState } from "react";
import { SUB, ASSUNTOS } from "../dados";
import { MAP } from "../mapa-brasil";
import { enviarRegistro, mensagemDeErro } from "../oathchain";
import { Aviso, irPara } from "../componentes";
import { SO_REVISOR_REGISTRA } from "../config";

const pad = (n) => String(n).padStart(2, "0");
const paraCampo = (dt) =>
  `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

export default function Registrar({ d, texto0 }) {
  const [tipo, setTipo] = useState("afirmacao");
  const [texto, setTexto] = useState(texto0 || "");
  const [referencia, setReferencia] = useState("");
  const [criterios, setCriterios] = useState("");
  const [prazo, setPrazo] = useState("");
  const [assunto, setAssunto] = useState(ASSUNTOS[0]);
  const [subassunto, setSubassunto] = useState("");
  const [uf, setUf] = useState("");
  const [cidade, setCidade] = useState("");
  const [substitui, setSubstitui] = useState("0");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");

  if (!d.conta) {
    return (
      <>
        <h2>Registrar</h2>
        <Aviso>
          Conecte sua carteira para registrar. <button className="wallet" onClick={d.conectar}>Conectar carteira</button>
        </Aviso>
      </>
    );
  }
  if (SO_REVISOR_REGISTRA && !d.euSouRevisor) {
    return (
      <>
        <h2>Registrar</h2>
        <Aviso>Só revisores cadastrados registram afirmações. Esta carteira não é de um revisor.</Aviso>
      </>
    );
  }

  const candidatos = d.registros.filter((r) => r.tipo === 0 && r.estado === 2 && !r.superadaPor);

  async function enviar(e) {
    e.preventDefault();
    setErro("");
    if (texto.trim().length < 10) return setErro("Escreva um texto com pelo menos 10 caracteres.");
    let prazoSeg = 0;
    if (tipo === "afirmacao" && !referencia.trim()) return setErro("Informe o período a que a afirmação se refere (por exemplo, 2025).");
    if (tipo === "promessa") {
      if (criterios.trim().length < 10) return setErro("Toda promessa precisa de critérios mensuráveis (mínimo de 10 caracteres).");
      if (!prazo) return setErro("Escolha o prazo da promessa.");
      prazoSeg = Math.floor(new Date(prazo).getTime() / 1000);
      if (prazoSeg <= Math.floor(Date.now() / 1000) + 60) return setErro("O prazo precisa estar pelo menos 1 minuto no futuro.");
    }
    setEnviando(true);
    try {
      const contrato = await d.obterContrato();
      const novoId = (d.resumo?.totalRegistros ?? 0) + 1;
      await enviarRegistro(contrato, {
        tipo, texto, criterios, prazo: prazoSeg, referencia, substitui: Number(substitui),
        assunto, subassunto, uf, cidade,
      });
      await d.atualizar();
      irPara("registro/" + novoId);
    } catch (err) {
      console.error(err);
      setErro(mensagemDeErro(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <h2>Registrar uma {tipo === "afirmacao" ? "afirmação" : "promessa"}</h2>
      <p className="mut" style={{ maxWidth: "62ch" }}>
        Isto grava o registro para sempre na blockchain e usa uma pequena taxa em ETH de teste. A MetaMask vai pedir a sua confirmação.
      </p>
      <form className="f card" onSubmit={enviar}>
        <div className="tabs">
          <button type="button" aria-pressed={tipo === "afirmacao"} onClick={() => setTipo("afirmacao")}>Afirmação</button>
          <button type="button" aria-pressed={tipo === "promessa"} onClick={() => setTipo("promessa")}>Promessa</button>
        </div>

        <label>
          {tipo === "afirmacao" ? "O que foi afirmado" : "O que foi prometido"}
          <textarea rows={3} value={texto} onChange={(e) => setTexto(e.target.value)}
            placeholder={tipo === "afirmacao" ? "Ex.: Cerca de 90% das casas de Vale Claro têm coleta de esgoto." : "Ex.: A Prefeitura vai inaugurar 10 escolas até 31/12/2027."} />
        </label>

        <div className="linha2">
          <label>Assunto
            <select value={assunto} onChange={(e) => { setAssunto(e.target.value); setSubassunto(""); }}>
              {ASSUNTOS.map((a) => <option key={a}>{a}</option>)}
            </select>
          </label>
          <label>Tema (opcional)
            <select value={subassunto} onChange={(e) => setSubassunto(e.target.value)}>
              <option value="">—</option>
              {SUB[assunto].map((s) => <option key={s}>{s}</option>)}
            </select>
          </label>
        </div>

        <div className="linha2">
          <label>Estado (opcional)
            <select value={uf} onChange={(e) => setUf(e.target.value)}>
              <option value="">Nacional / não definido</option>
              {Object.entries(MAP).sort((a, b) => a[1].n.localeCompare(b[1].n)).map(([k, m]) => <option key={k} value={k}>{m.n}</option>)}
            </select>
          </label>
          <label>Cidade (opcional)
            <input type="text" value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="Ex.: Goiânia" />
          </label>
        </div>

        {tipo === "afirmacao" ? (
          <>
            <label>Período a que se refere
              <input type="text" value={referencia} onChange={(e) => setReferencia(e.target.value)} placeholder="Ex.: 2025, out/2026, 1º semestre de 2026" />
            </label>
            {candidatos.length > 0 && (
              <label>Este registro corrige outro? (opcional)
                <select value={substitui} onChange={(e) => setSubstitui(e.target.value)}>
                  <option value="0">Não, é um registro novo</option>
                  {candidatos.map((c) => <option key={c.id} value={c.id}>#{c.id} · {c.texto.slice(0, 60)} ({c.referencia})</option>)}
                </select>
              </label>
            )}
          </>
        ) : (
          <>
            <label>Critérios mensuráveis (como saber se foi cumprida)
              <textarea rows={2} value={criterios} onChange={(e) => setCriterios(e.target.value)} placeholder="Ex.: 10 escolas inauguradas, conforme o portal de obras." />
            </label>
            <label>Prazo
              <input type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </label>
            <div className="mini">
              Para testes:{" "}
              <button type="button" className="wallet" onClick={() => setPrazo(paraCampo(new Date(Date.now() + 3 * 60000)))}>daqui a 3 min</button>{" "}
              <button type="button" className="wallet" onClick={() => setPrazo(paraCampo(new Date(Date.now() + 10 * 60000)))}>daqui a 10 min</button>
            </div>
          </>
        )}

        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <div>
          <button className="main-btn" type="submit" disabled={enviando}>
            {enviando ? "Aguardando a rede…" : "Registrar na blockchain"}
          </button>
        </div>
      </form>
    </>
  );
}
