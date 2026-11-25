import { useEffect, useState } from "react";
import { useDados } from "./useDados";
import { Aviso } from "./componentes";
import { abreviar } from "./oathchain";
import { NOME_DA_REDE, CHAIN_ID, CONTRACT_ADDRESS, EXPLORADOR } from "./config";
import Explorar from "./paginas/Explorar";
import Registrar from "./paginas/Registrar";
import Registro from "./paginas/Registro";
import Participar from "./paginas/Participar";
import { Sala } from "./paginas/Assuntos";
import Inicio from "./paginas/Inicio";
import { useRolagemSuave, irAoTopo } from "./rolagem";
import { useMovimentoReduzido } from "./movimento";

// A página atual vem do endereço (#explorar/mapa, #registro/3, #assunto/Economia...)
function useRota() {
  const ler = () => {
    const [primeira, ...resto] = window.location.hash.slice(1).split("/");
    return { rota: primeira || "inicio", param: decodeURIComponent(resto.join("/")) };
  };
  const [r, setR] = useState(ler);
  useEffect(() => {
    const aoMudar = () => {
      setR(ler());
      irAoTopo();
    };
    window.addEventListener("hashchange", aoMudar);
    return () => window.removeEventListener("hashchange", aoMudar);
  }, []);
  return r;
}

// Menu com 3 itens. Os endereços antigos continuam valendo e caem na aba certa.
const MENU = [
  ["inicio", "Início"],
  ["explorar", "Explorar"],
  ["participar", "Participar"],
];
// Ícones do menu: só aparecem no celular, onde o menu vira uma barra fixa embaixo da tela
const ICONE = {
  inicio: <path d="M4 11 12 4l8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z" />,
  explorar: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  participar: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5" /><path d="M15.5 5.6a3.2 3.2 0 0 1 0 5.8M17.5 14.4c1.6.7 2.7 2.3 3 4.6" /></>,
};
const ABA_ANTIGA = { estante: "estante", mapa: "mapa", linha: "linha", assuntos: "estante", verificar: "lista" };
const SECAO = {
  explorar: "explorar", estante: "explorar", mapa: "explorar", linha: "explorar", assuntos: "explorar", verificar: "explorar",
  assunto: "explorar", registro: "explorar", registrar: "explorar",
  participar: "participar", revisores: "participar", revisor: "participar",
};

export default function App() {
  const d = useDados();
  const { rota, param } = useRota();
  useRolagemSuave(useMovimentoReduzido());
  const ativo = SECAO[rota] || "inicio";

  let pagina;
  if (rota === "explorar") pagina = <Explorar d={d} aba={param || "lista"} />;
  else if (ABA_ANTIGA[rota]) pagina = <Explorar d={d} aba={ABA_ANTIGA[rota]} q0={rota === "verificar" ? param : ""} />;
  else if (rota === "registrar") pagina = <Registrar d={d} texto0={param} />;
  else if (rota === "registro") pagina = <Registro d={d} id={param} />;
  else if (rota === "assunto") pagina = <Sala d={d} nome={param} />;
  else if (SECAO[rota] === "participar") pagina = <Participar d={d} />;
  else pagina = <Inicio d={d} />;
  const inicio = ativo === "inicio";

  return (
    <>
      <header className="topo">
        <div className="topo-in">
          <button className="marca" aria-label="OathChain, página inicial" onClick={() => { window.location.hash = "inicio"; }}>
            <img src="/logo-fundo-escuro.png" alt="OathChain" />
          </button>
          <nav className="menu" aria-label="Principal">
            {MENU.map(([k, nome]) => (
              <button key={k} aria-current={ativo === k ? "page" : undefined} onClick={() => { window.location.hash = k; }}>
                <svg className="menu-ic" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONE[k]}</svg>
                {nome}
              </button>
            ))}
          </nav>
          {d.conta ? (
            <button className="wallet on" onClick={d.escolherContas} title="Trocar de conta">{abreviar(d.conta)}</button>
          ) : (
            <button className="wallet" onClick={d.conectar}>Conectar carteira</button>
          )}
        </div>
      </header>

      <main className={inicio ? "cheia" : undefined}>
        <div className="avisos" style={inicio ? { maxWidth: 1200, margin: "0 auto", padding: "0 20px" } : undefined}>
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
        {/* key muda a cada página: o React remonta e a transição de entrada toca de novo */}
        <section key={rota + "/" + param} className="pg on troca">{pagina}</section>
      </main>

      <footer className="rodape">
        <span>Protótipo acadêmico na rede de testes {NOME_DA_REDE}. Nada aqui vale como decisão oficial.</span>
        <span style={{ display: "flex", gap: 20 }}>
          <a href={`${EXPLORADOR}/address/${CONTRACT_ADDRESS}#code`} target="_blank" rel="noreferrer">Contrato no Etherscan</a>
          <a href="https://github.com/paivafgustavo/OathChain" target="_blank" rel="noreferrer">Código</a>
        </span>
      </footer>
    </>
  );
}
