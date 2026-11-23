import { useCallback, useEffect, useState } from "react";
import { formatEther } from "ethers";
import { Aviso } from "../componentes";
import { abreviar, executar, formatarDuracao, mensagemDeErro, restante } from "../oathchain";

const ESTADOS = ["Não candidato", "Aprendiz (em prova)", "Revisor", "Saiu"];

export default function SejaRevisor({ d, embutido = false }) {
  const [info, setInfo] = useState(null);
  const [lista, setLista] = useState([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");

  const carregar = useCallback(async () => {
    if (!d.gestaoValida) return;
    try {
      const g = await d.lerGestao();
      const [deposito, minVotos, maxFaltas, periodo, multaPct, janela, pct] = await Promise.all([
        g.deposito(), g.minVotosProva(), g.maxFaltas(), g.periodoMinimoProva(), g.multaPorFaltaPct(), g.janelaCrescimento(), g.crescimentoPct(),
      ]);
      const meu = d.conta ? await g.obterCandidato(d.conta) : null;
      const podePromover = d.conta ? await g.podePromover(d.conta) : false;
      const enderecos = await g.listarCandidatos();
      const todos = await Promise.all(enderecos.map(async (e) => ({ e, c: await g.obterCandidato(e) })));
      setInfo({
        deposito, minVotos: Number(minVotos), maxFaltas: Number(maxFaltas), periodo: Number(periodo), multaPct: Number(multaPct),
        janela: Number(janela), pct: Number(pct),
        meu: meu && { estado: Number(meu.estado), desde: Number(meu.desde), votosProva: Number(meu.votosProva), faltas: Number(meu.faltas), deposito: meu.deposito },
        podePromover,
      });
      setLista(todos.map(({ e, c }) => ({ e, estado: Number(c.estado), votos: Number(c.votosProva), faltas: Number(c.faltas) })));
    } catch (e) {
      console.error(e);
      setErro("Não consegui ler o contrato de candidatura.");
    }
  }, [d.gestaoValida, d.conta, d.registros]);

  useEffect(() => { carregar(); }, [carregar]);

  async function agir(nome, args = [], opcoes) {
    setErro(""); setOk(""); setOcupado(true);
    try {
      const g = await d.obterGestao();
      const tx = await g[nome](...args, ...(opcoes ? [opcoes] : []));
      await tx.wait();
      setOk("Pronto! Transação confirmada.");
      await d.atualizar();
      await carregar();
    } catch (e) {
      console.error(e);
      setErro(mensagemDeErro(e));
    } finally { setOcupado(false); }
  }

  const meu = info?.meu;
  const agora = d.agora;
  const barra = (v, max) => Math.min(100, Math.round((v / Math.max(1, max)) * 100));

  return (
    <>
      {!embutido && <h2>Seja revisor</h2>}
      <p className="mut" style={{ maxWidth: "66ch", display: embutido ? "none" : undefined }}>
        Ninguém precisa pedir permissão a uma pessoa: você se candidata, passa por um período de prova observando júris reais e é promovido automaticamente.
        O contrato <b>nunca</b> compara o seu voto com o da maioria. Você é avaliado por <b>participar com fundamentação</b> (justificativa e link de fonte), não por concordar.
      </p>

      {!d.gestaoValida && (
        <Aviso>O contrato de candidatura ainda não foi publicado (falta <code>GestaoRevisores</code> em <code>deployment.json</code>). Rode o deploy v5.</Aviso>
      )}

      {info && (
        <div className="rvg">
          <div className="card">
            <small>Sua situação</small>
            <h3 style={{ font: "600 28px Sora,sans-serif", margin: "4px 0 8px" }}>{d.conta ? abreviar(d.conta) : "Conecte a carteira"}</h3>
            {d.conta && <span className="tag">{d.euSouRevisor && (!meu || meu.estado === 0) ? "Revisor (cadastrado pelo dono)" : ESTADOS[meu?.estado || 0]}</span>}

            {meu && meu.estado === 1 && (
              <div style={{ marginTop: 14 }}>
                <p style={{ margin: "0 0 4px" }}>Votos de prova: <b>{meu.votosProva}</b> de {info.minVotos}</p>
                <div className="barra-conf"><i style={{ width: barra(meu.votosProva, info.minVotos) + "%" }} /></div>
                <p style={{ margin: "10px 0 4px" }}>Tempo de prova: {agora >= meu.desde + info.periodo ? "cumprido" : `faltam ${restante(meu.desde + info.periodo, agora)}`}</p>
                <p style={{ margin: "4px 0" }}>Faltas: <b>{meu.faltas}</b> (máximo {info.maxFaltas})</p>
                <p style={{ margin: "4px 0" }}>Depósito atual: <b>{formatEther(meu.deposito)} ETH</b></p>
                <div className="acts2">
                  <button className="main-btn peq" disabled={ocupado || !info.podePromover} onClick={() => agir("promover", [d.conta])}>
                    {info.podePromover ? "Virar revisor agora" : "Ainda não cumpriu os critérios"}
                  </button>
                  {meu.faltas > info.maxFaltas && <button disabled={ocupado} onClick={() => agir("rebaixar", [d.conta])}>Aceitar a saída por excesso de faltas</button>}
                  <button disabled={ocupado} onClick={() => agir("sair")}>Desistir e sacar o depósito</button>
                </div>
              </div>
            )}

            {meu && meu.estado === 2 && (
              <div className="acts2">
                <button disabled={ocupado} onClick={() => agir("sair")}>Deixar de ser revisor e sacar o depósito</button>
              </div>
            )}
            {meu && meu.estado === 3 && meu.deposito > 0n && (
              <div className="acts2"><button disabled={ocupado} onClick={() => agir("sacar")}>Sacar o que restou do depósito</button></div>
            )}

            {d.conta && (!meu || meu.estado === 0 || meu.estado === 3) && !d.euSouRevisor && (
              <div style={{ marginTop: 14 }}>
                <p style={{ margin: "0 0 8px" }}>
                  Depósito de garantia: <b>{formatEther(info.deposito)} ETH</b> (de teste). Você recebe de volta ao sair, menos {info.multaPct}% por cada falta
                  (falta = ser sorteado e não votar).
                </p>
                <div className="acts2">
                  <button className="main-btn peq" disabled={ocupado} onClick={() => agir("candidatar", [], { value: info.deposito })}>Candidatar-me como aprendiz</button>
                </div>
              </div>
            )}
            {!d.conta && <div className="acts2"><button className="main-btn peq" onClick={d.conectar}>Conectar carteira</button></div>}
            {ok && <Aviso tipo="ok">{ok}</Aviso>}
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
          </div>

          <div className="card">
            <h3>Como funciona</h3>
            <ol className="passos">
              <li><b>Candidatura:</b> depósito de {formatEther(info.deposito)} ETH de teste. Você vira aprendiz.</li>
              <li><b>Prova:</b> é sorteado como observador em júris reais e vota sem que o seu voto conte no resultado. Cada voto precisa de justificativa e link de fonte.</li>
              <li><b>Promoção automática:</b> {info.minVotos} votos de prova, no máximo {info.maxFaltas} faltas e {formatarDuracao(info.periodo)} de prova.</li>
              <li><b>Freio contra enxurrada de contas:</b> só {info.pct}% do total de revisores (mínimo 1) pode ser promovido a cada {formatarDuracao(info.janela)}.</li>
              <li><b>Sem "maria vai com as outras":</b> discordar da maioria não gera nenhuma punição. Só a falta de participação.</li>
            </ol>
          </div>
        </div>
      )}

      {lista.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3>Candidatos</h3>
          <table className="tb">
            <thead><tr><th>Carteira</th><th>Situação</th><th>Votos de prova</th><th>Faltas</th></tr></thead>
            <tbody>
              {lista.map((x) => (
                <tr key={x.e}><td>{abreviar(x.e)}</td><td>{ESTADOS[x.estado]}</td><td>{x.votos}</td><td>{x.faltas}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
