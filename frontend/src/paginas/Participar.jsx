// Participar: candidatura + painel do revisor + lista de revisores (antes eram 2 páginas no menu).
import SejaRevisor from "./SejaRevisor";
import Revisores from "./Revisores";

const PASSOS = [
  ["1", "Candidate-se", "Deixe um depósito em ETH de teste. Ele volta quando você sair, menos eventuais multas por falta."],
  ["2", "Prove como aprendiz", "Você é sorteado para júris reais e vota com justificativa e fonte. O voto fica registrado, mas ainda não decide."],
  ["3", "Vire revisor", "Cumpriu os requisitos? Qualquer pessoa chama a promoção e o contrato confere. Aí seu voto passa a contar."],
];

export default function Participar({ d }) {
  // Quem já é revisor vê primeiro o próprio painel; os demais, a candidatura
  const blocos = d.euSouRevisor
    ? [<Revisores key="r" d={d} embutido />, <SejaRevisor key="s" d={d} embutido />]
    : [<SejaRevisor key="s" d={d} embutido />, <Revisores key="r" d={d} embutido />];

  return (
    <>
      <section className="part-topo">
        <p className="etq">Participar</p>
        <h1>Ninguém aprova você. Seus votos aprovam.</h1>
        <p className="mut">
          Para virar revisor não existe porteiro: você se candidata, prova o trabalho votando em júris de verdade e é promovido pelo contrato.
          Discordar da maioria nunca é punido; a multa é só para quem é sorteado e não vota.
        </p>
      </section>

      <ol className="part-passos">
        {PASSOS.map(([n, t, txt], i) => (
          <li key={n} className="card inclina" style={{ animationDelay: i * 90 + "ms" }}>
            <span className={"part-n" + (i === 2 ? " ok" : "")}>{n}</span>
            <h2>{t}</h2>
            <p className="mut">{txt}</p>
          </li>
        ))}
      </ol>

      <div className="part-blocos">{blocos}</div>
    </>
  );
}
