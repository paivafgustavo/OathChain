import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, isAddress } from "ethers";
import abi from "./abi.json";
import {
  CONTRACT_ADDRESS,
  CHAIN_ID,
  CHAIN_ID_HEX,
  NOME_DA_REDE,
  EXPLORADOR,
} from "./config";
import { abreviar, carregarResumo, carregarRegistros } from "./oathchain";
import Registrar from "./Registrar";
import Cartao from "./Cartao";
import "./App.css";

export default function App() {
  const [conta, setConta] = useState(null);
  const [redeCorreta, setRedeCorreta] = useState(false);
  const [chainIdAtual, setChainIdAtual] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const [agoraMs, setAgoraMs] = useState(Date.now());

  const enderecoValido = isAddress(CONTRACT_ADDRESS);

  // Relógio: atualiza a cada 15 s para os prazos e janelas serem reavaliados
  useEffect(() => {
    const t = setInterval(() => setAgoraMs(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Lê os dados do contrato (só leitura, não custa nada)
  const atualizar = useCallback(async () => {
    if (!window.ethereum) return;
    setCarregando(true);
    setErro("");
    try {
      const provider = new BrowserProvider(window.ethereum);
      const rede = await provider.getNetwork();
      const certa = Number(rede.chainId) === CHAIN_ID;
      setChainIdAtual(Number(rede.chainId));
      setRedeCorreta(certa);
      if (!certa || !enderecoValido) {
        setResumo(null);
        setRegistros([]);
        return;
      }
      // Conta atualmente selecionada na MetaMask (lida na hora, sem depender do estado)
      const contas = await window.ethereum.request({ method: "eth_accounts" });
      const contaAtual = contas[0] || null;
      setConta(contaAtual);

      const contrato = new Contract(CONTRACT_ADDRESS, abi, provider);
      setResumo(await carregarResumo(contrato));
      setRegistros(await carregarRegistros(contrato, contaAtual));
      setAgoraMs(Date.now());
    } catch (e) {
      console.error(e);
      setErro("Não foi possível ler o contrato. Confira o endereço em config.js e a rede.");
    } finally {
      setCarregando(false);
    }
  }, [enderecoValido]);

  async function conectar() {
    setErro("");
    if (!window.ethereum) {
      setErro("MetaMask não encontrada. Instale a extensão e recarregue a página.");
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      await atualizar();
    } catch (e) {
      console.error(e);
      setErro("A conexão foi cancelada ou falhou.");
    }
  }

  // Abre a janela da MetaMask para escolher quais contas este site pode usar
  async function escolherContas() {
    setErro("");
    try {
      await window.ethereum.request({
        method: "wallet_requestPermissions",
        params: [{ eth_accounts: {} }],
      });
      await atualizar();
    } catch (e) {
      console.error(e);
      if (e.code !== 4001) setErro("Não consegui abrir a escolha de contas na MetaMask.");
    }
  }

  // Contrato ligado à carteira: necessário para enviar transações
  async function obterContratoAssinado() {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, abi, signer);
  }

  async function trocarParaSepolia() {
    setErro("");
    try {
      await window.ethereum.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: CHAIN_ID_HEX }],
      });
      await atualizar();
    } catch (e) {
      console.error(e);
      if (e.code === 4902) {
        try {
          await window.ethereum.request({
            method: "wallet_addEthereumChain",
            params: [
              {
                chainId: CHAIN_ID_HEX,
                chainName: "Sepolia",
                nativeCurrency: { name: "Sepolia ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                blockExplorerUrls: [EXPLORADOR],
              },
            ],
          });
          await atualizar();
        } catch (e2) {
          console.error(e2);
          setErro("Não consegui adicionar a rede. Selecione a Sepolia direto na MetaMask.");
        }
      } else if (e.code === -32002) {
        setErro("Já existe um pedido aberto na MetaMask. Clique no ícone da extensão e responda a ele.");
      } else if (e.code === 4001) {
        setErro("Você recusou a troca de rede na MetaMask.");
      } else {
        setErro("Não consegui trocar de rede. Selecione a Sepolia direto na MetaMask e recarregue a página.");
      }
    }
  }

  // Reage quando o usuário troca de conta ou de rede na MetaMask
  useEffect(() => {
    if (!window.ethereum) return;
    const aoTrocar = () => atualizar();
    window.ethereum.on("accountsChanged", aoTrocar);
    window.ethereum.on("chainChanged", aoTrocar);
    return () => {
      window.ethereum.removeListener("accountsChanged", aoTrocar);
      window.ethereum.removeListener("chainChanged", aoTrocar);
    };
  }, [atualizar]);

  // Se a MetaMask já estava conectada, reaproveita a conexão
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then((contas) => {
      if (contas.length > 0) atualizar();
    });
  }, [atualizar]);

  return (
    <div className="app">
      <header className="topo">
        <div>
          <h1>⛓️ OathChain</h1>
          <p className="sub">Livro-razão público de promessas e afirmações verificadas</p>
        </div>
        <div className="conexao">
          {conta ? (
            <div className="conta-bloco">
              <span className="pilula">🟢 {abreviar(conta)}</span>
              <button className="botao pequeno claro" onClick={escolherContas}>
                Trocar conta
              </button>
            </div>
          ) : (
            <button className="botao" onClick={conectar}>
              Conectar MetaMask
            </button>
          )}
        </div>
      </header>

      {!enderecoValido && (
        <div className="aviso">
          Falta configurar o endereço do contrato. Abra <code>src/config.js</code> e cole o
          endereço do OathChain na Sepolia em <code>CONTRACT_ADDRESS</code>.
        </div>
      )}

      {chainIdAtual !== null && !redeCorreta && (
        <div className="aviso">
          Você está em outra rede (chainId {chainIdAtual}). Esta aplicação funciona na{" "}
          {NOME_DA_REDE} (chainId {CHAIN_ID}).{" "}
          <button className="botao pequeno" onClick={trocarParaSepolia}>
            Trocar para {NOME_DA_REDE}
          </button>
        </div>
      )}

      {erro && <div className="aviso erro">{erro}</div>}

      {!conta && enderecoValido && (
        <p className="vazio">
          Conecte sua carteira para ver os registros. Se você acabou de trocar de conta na
          MetaMask, clique em "Conectar" para liberar a nova conta.
        </p>
      )}

      {resumo && (
        <section className="resumo">
          <div className="numero">
            <strong>{resumo.totalRegistros}</strong>
            <span>registros</span>
          </div>
          <div className="numero">
            <strong>{resumo.revisoresAtivos}</strong>
            <span>revisores ativos</span>
          </div>
          <div className="numero">
            <strong>{resumo.minRevisores}</strong>
            <span>mínimo para votar</span>
          </div>
          <div className="numero">
            <strong>{resumo.janelaDias}</strong>
            <span>dias de votação</span>
          </div>
        </section>
      )}

      {resumo && conta && redeCorreta && (
        <Registrar obterContrato={obterContratoAssinado} aoConcluir={atualizar} />
      )}

      {resumo && (
        <section>
          <div className="titulo-lista">
            <h2>Registros</h2>
            <button className="botao pequeno" onClick={atualizar} disabled={carregando}>
              {carregando ? "Atualizando..." : "Atualizar"}
            </button>
          </div>

          {registros.length === 0 ? (
            <p className="vazio">Nenhum registro ainda.</p>
          ) : (
            <div className="lista">
              {registros.map((r) => (
                <Cartao
                  key={r.id}
                  r={r}
                  conta={conta}
                  minRevisores={resumo.minRevisores}
                  revisoresAtivos={resumo.revisoresAtivos}
                  agoraMs={agoraMs}
                  obterContrato={obterContratoAssinado}
                  aoConcluir={atualizar}
                />
              ))}
            </div>
          )}
        </section>
      )}

      <footer className="rodape">
        Protótipo acadêmico em testnet. Contrato:{" "}
        {enderecoValido ? (
          <a href={`${EXPLORADOR}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">
            {abreviar(CONTRACT_ADDRESS)}
          </a>
        ) : (
          "não configurado"
        )}
      </footer>
    </div>
  );
}
