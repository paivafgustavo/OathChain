import { useState } from "react";
import { enviarRegistro, mensagemDeErro } from "./oathchain";
import { EXPLORADOR } from "./config";

// Converte o valor do campo de data/hora (hora local) em timestamp em segundos
function paraTimestamp(valor) {
  return Math.floor(new Date(valor).getTime() / 1000);
}

// Texto "AAAA-MM-DDTHH:MM" em hora local, para preencher o campo de data
function paraCampoData(data) {
  const pad = (n) => String(n).padStart(2, "0");
  return (
    data.getFullYear() + "-" + pad(data.getMonth() + 1) + "-" + pad(data.getDate()) +
    "T" + pad(data.getHours()) + ":" + pad(data.getMinutes())
  );
}

export default function Registrar({ obterContrato, aoConcluir }) {
  const [tipo, setTipo] = useState("afirmacao");
  const [texto, setTexto] = useState("");
  const [criterios, setCriterios] = useState("");
  const [prazo, setPrazo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState("");
  const [hash, setHash] = useState("");

  function daquiAMinutos(min) {
    setPrazo(paraCampoData(new Date(Date.now() + min * 60 * 1000)));
  }

  async function enviar(evento) {
    evento.preventDefault();
    setErro("");
    setHash("");

    if (texto.trim().length < 10) {
      setErro("Escreva um texto com pelo menos 10 caracteres.");
      return;
    }
    let prazoSegundos = 0;
    if (tipo === "promessa") {
      if (criterios.trim().length < 10) {
        setErro("Toda promessa precisa de critérios mensuráveis (mínimo de 10 caracteres).");
        return;
      }
      if (!prazo) {
        setErro("Escolha o prazo da promessa.");
        return;
      }
      prazoSegundos = paraTimestamp(prazo);
      if (prazoSegundos <= Math.floor(Date.now() / 1000) + 60) {
        setErro("O prazo precisa estar pelo menos 1 minuto no futuro.");
        return;
      }
    }

    setEnviando(true);
    try {
      const contrato = await obterContrato();
      const h = await enviarRegistro(contrato, {
        tipo,
        texto,
        criterios,
        prazo: prazoSegundos,
      });
      setHash(h);
      setTexto("");
      setCriterios("");
      setPrazo("");
      await aoConcluir();
    } catch (e) {
      console.error(e);
      setErro(mensagemDeErro(e));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <section className="formulario">
      <h2>Novo registro</h2>

      <div className="alternar">
        <button
          type="button"
          className={tipo === "afirmacao" ? "ativo" : ""}
          onClick={() => setTipo("afirmacao")}
        >
          🗣️ Afirmação
        </button>
        <button
          type="button"
          className={tipo === "promessa" ? "ativo" : ""}
          onClick={() => setTipo("promessa")}
        >
          🤝 Promessa
        </button>
      </div>

      <form onSubmit={enviar}>
        <label>
          {tipo === "afirmacao" ? "O que foi afirmado" : "O que foi prometido"}
          <textarea
            rows={3}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={
              tipo === "afirmacao"
                ? "Ex.: A inflação anual caiu para menos de 4% em 2025."
                : "Ex.: A Prefeitura de Exemplo vai inaugurar 10 escolas até 31/12/2027."
            }
          />
        </label>

        {tipo === "promessa" && (
          <>
            <label>
              Critérios mensuráveis (como saber se foi cumprida)
              <textarea
                rows={2}
                value={criterios}
                onChange={(e) => setCriterios(e.target.value)}
                placeholder="Ex.: 10 escolas inauguradas, conforme o portal de obras."
              />
            </label>

            <label>
              Prazo
              <input type="datetime-local" value={prazo} onChange={(e) => setPrazo(e.target.value)} />
            </label>
            <div className="atalhos">
              <span>Para testes:</span>
              <button type="button" className="botao pequeno claro" onClick={() => daquiAMinutos(3)}>
                daqui a 3 min
              </button>
              <button type="button" className="botao pequeno claro" onClick={() => daquiAMinutos(10)}>
                daqui a 10 min
              </button>
            </div>
          </>
        )}

        {erro && <div className="aviso erro">{erro}</div>}
        {hash && (
          <div className="aviso ok">
            Registro enviado!{" "}
            <a href={`${EXPLORADOR}/tx/${hash}`} target="_blank" rel="noreferrer">
              Ver a transação
            </a>
          </div>
        )}

        <button className="botao" type="submit" disabled={enviando}>
          {enviando ? "Aguardando a rede..." : "Registrar na blockchain"}
        </button>
        <p className="nota">
          Isto grava o registro para sempre e usa uma pequena taxa em ETH de teste. A MetaMask vai
          pedir a sua confirmação.
        </p>
      </form>
    </section>
  );
}
