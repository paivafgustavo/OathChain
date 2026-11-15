import { useEffect, useState } from "react";
import { ST } from "../dados";
import { Ir, curto } from "../componentes";
import { abreviar, carregarRevisores, restante } from "../oathchain";
import { SO_REVISOR_REGISTRA } from "../config";

const mesAno = (seg) => (seg ? new Date(seg * 1000).toLocaleDateString("pt-BR", { month: "short", year: "numeric" }) : "—");

export default function Revisores({ d }) {
  const [lista, setLista] = useState(null);
  const { registros, agora, conta } = d;

  useEffect(() => {
    let vivo = true;
    d.lerContrato()
      .then((c) => carregarRevisores(c, registros))
      .then((l) => vivo && setLista(l))
      .catch(() => vivo && setLista([]));
    return () => {
      vivo = false;
    };
  }, [registros]);

  const eu = conta && lista ? lista.find((x) => x.endereco.toLowerCase() === conta.toLowerCase()) : null;
  const aguardando = registros.filter((r) => r.estado === 1 && r.euPossoVotar && r.meuVoto === 0 && agora < r.fimVotacao);
  const comVoto = registros.filter((r) => r.estado === 2 && r.meuVoto > 0);
  const acordo = comVoto.length ? Math.round((comVoto.filter((r) => r.meuVoto === r.resultado).length / comVoto.length) * 100) : null;

  return (
    <>
      <h2>Revisores</h2>
      <p className="mut" style={{ maxWidth: "64ch" }}>
        Revisores são as pessoas cadastradas que conferem cada afirmação e votam. O veredito só vale com mais de 50% dos votos, e cada voto fica gravado. Quem não é revisor apenas lê.
      </p>
      <div className="rvg">
        <div className="card">
          {d.euSouRevisor && conta ? (
            <>
              <small>Painel do revisor</small>
              <h3 style={{ font: "600 30px Newsreader,serif", margin: "4px 0 8px" }}>{abreviar(conta)}</h3>
              <span className="tag">Revisor cadastrado · carteira conectada</span>
              <div className="rvs">
                <div><div className="stat">{eu ? eu.votos : "…"}</div><small>votos dados</small></div>
                <div><div className="stat">{aguardando.length}</div><small>aguardando seu voto</small></div>
                <div><div className="stat">{acordo === null ? "—" : acordo + "%"}</div><small>de acordo com a maioria</small></div>
              </div>
              <h3>Aguardando seu voto</h3>
              {aguardando.length === 0 && <p className="mut" style={{ fontSize: 14 }}>Nenhum registro esperando o seu voto agora.</p>}
              {aguardando.map((r) => (
                <Ir key={r.id} className="res" para={"registro/" + r.id}>
                  <span className="sp" style={{ background: `var(${ST.w[1]})` }} />
                  <span>
                    <b>{curto(r.texto, 90)}</b>
                    <small>{r.assunto} · faltam {restante(r.fimVotacao, agora)}</small>
                  </span>
                  <span className="votar">Votar</span>
                </Ir>
              ))}
            </>
          ) : (
            <>
              <small>Painel do revisor</small>
              <h3 style={{ font: "600 26px Newsreader,serif", margin: "4px 0 8px" }}>
                {conta ? "Esta carteira não é de um revisor" : "Conecte uma carteira de revisor"}
              </h3>
              <p className="mut" style={{ fontSize: 14 }}>
                {conta ? `Conectada: ${abreviar(conta)}. ` : ""}Revisores cadastrados veem aqui os votos que dependem deles.
              </p>
              {!conta && <button className="wallet" onClick={d.conectar}>Conectar carteira</button>}
            </>
          )}
          <p className="mut" style={{ margin: "14px 0 8px", fontSize: 14 }}>
            Antes de registrar, pesquise: se a afirmação já existe, não precisa registrar de novo.
          </p>
          <Ir className="wallet" para="verificar">{SO_REVISOR_REGISTRA ? "Pesquisar para registrar uma afirmação" : "Pesquisar uma afirmação"}</Ir>
        </div>

        <div className="card">
          <h3>Revisores cadastrados</h3>
          {lista === null ? (
            <p className="mut">Lendo a lista…</p>
          ) : (
            <table className="tb">
              <thead><tr><th>Carteira</th><th>Desde</th><th>Votos</th></tr></thead>
              <tbody>
                {lista.map((x) => (
                  <tr key={x.endereco} style={{ opacity: x.ativo ? 1 : 0.5 }}>
                    <td>
                      <code>{abreviar(x.endereco)}</code>
                      {conta && x.endereco.toLowerCase() === conta.toLowerCase() && <> <span className="tag">você</span></>}
                      {!x.ativo && <> <span className="tag">removido</span></>}
                    </td>
                    <td>{mesAno(x.desde)}</td>
                    <td>{x.votos}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mut" style={{ fontSize: 14, margin: "12px 0 0" }}>
            Cada voto é assinado na MetaMask. Nunca pedimos a sua frase-semente.
          </p>
        </div>
      </div>
    </>
  );
}
