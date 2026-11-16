import { useEffect, useState } from "react";
import { useDados } from "./useDados";
import { Aviso } from "./componentes";
import { abreviar } from "./oathchain";
import { NOME_DA_REDE, CHAIN_ID } from "./config";
import Estante from "./paginas/Estante";
import Verificar from "./paginas/Verificar";
import Registrar from "./paginas/Registrar";
import Registro from "./paginas/Registro";
import Mapa from "./paginas/Mapa";
import Revisores from "./paginas/Revisores";
import Linha from "./paginas/Linha";
import { Hub, Sala } from "./paginas/Assuntos";
import Inicio from "./paginas/Inicio";

// A página atual vem do endereço (#estante, #registro/3, #assunto/Economia...)
function useRota() {
  const ler = () => {
    const [primeira, ...resto] = window.location.hash.slice(1).split("/");
    return { rota: primeira || "inicio", param: decodeURIComponent(resto.join("/")) };
  };
  const [r, setR] = useState(ler);
  useEffect(() => {
    const aoMudar = () => {
      setR(ler());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);
  return r;
}

const MENU = [
  ["inicio", "Início"],
  ["estante", "Estante"],
  ["verificar", "Verificar"],
  ["mapa", "Mapa"],
  ["revisores", "Revisores"],
  ["linha", "Linha do tempo"],
  ["assuntos", "Assuntos"],
];

export default function App() {
  const d = useDados();
  const { rota, param } = useRota();
  const ativo = { registro: "verificar", registrar: "verificar", assunto: "assuntos" }[rota] || rota;
  const paginaInicial = !["estante", "verificar", "registrar", "registro", "mapa", "revisores", "linha", "assuntos", "assunto"].includes(rota);

  let pagina;
  switch (rota) {
    case "verificar": pagina = <Verificar d={d} q0={param} key={param} />; break;
    case "registrar": pagina = <Registrar d={d} texto0={param} />; break;
    case "registro": pagina = <Registro d={d} id={param} />; break;
    case "mapa": pagina = <Mapa d={d} />; break;
    case "revisores": pagina = <Revisores d={d} />; break;
    case "linha": pagina = <Linha d={d} />; break;
    case "assuntos": pagina = <Hub d={d} />; break;
    case "assunto": pagina = <Sala d={d} nome={param} />; break;
    case "estante": pagina = <Estante d={d} />; break;
    default: pagina = <Inicio d={d} />;
  }

  return (
    <>
      <header>
          <button className="logo" aria-label="OathChain, página inicial" onClick={() => { window.location.hash = "inicio"; }}>
            <img src="/logo-fundo-escuro.png" alt="OathChain" />
          </button>
          <nav aria-label="Principal">
            {MENU.map(([k, nome]) => (
              <button key={k} aria-current={ativo === k ? "page" : undefined} onClick={() => { window.location.hash = k; }}>
                {nome}
              </button>
            ))}
          </nav>
          {d.conta ? (
            <button className="wallet on" onClick={d.escolherContas} title="Trocar de conta">
              🟢 {abreviar(d.conta)}
            </button>
          ) : (
            <button className="wallet" onClick={d.conectar}>Conectar carteira</button>
          )}
      </header>

      <main className={paginaInicial ? "cheia" : undefined}>
        <div className="avisos">
        {!d.enderecoValido && (
          <Aviso>
            Falta o endereço do contrato. Rode o <code>deploy.js</code> na Sepolia (ele grava o endereço em
            <code> src/deployment.json</code>) ou cole o endereço em <code>src/config.js</code>.
          </Aviso>
        )}
        {d.chainIdAtual !== null && !d.redeCorreta && (
          <Aviso>
            Você está em outra rede (chainId {d.chainIdAtual}). Este site funciona na {NOME_DA_REDE} (chainId {CHAIN_ID}).{" "}
            <button className="wallet" onClick={d.trocarParaSepolia}>Trocar para {NOME_DA_REDE}</button>
          </Aviso>
        )}
        {d.erro && <Aviso tipo="erro">{d.erro}</Aviso>}
        </div>
        <section className="pg on">{pagina}</section>
        <footer className="mut" style={{ marginTop: 40, fontSize: 13, textAlign: "center" }}>
          Protótipo acadêmico em rede de testes. Os dados vêm do contrato; nada aqui vale como decisão oficial.
        </footer>
      </main>
    </>
  );
}
