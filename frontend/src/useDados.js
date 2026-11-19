import { useCallback, useEffect, useState } from "react";
import { BrowserProvider, Contract, JsonRpcProvider, isAddress } from "ethers";
import abi from "./abi.json";
import abiGestao from "./abiGestao.json";
import { CONTRACT_ADDRESS, GESTAO_ADDRESS, CHAIN_ID, CHAIN_ID_HEX, EXPLORADOR, RPC_PUBLICO } from "./config";
import { carregarResumo, carregarRegistros } from "./oathchain";

// Tudo o que as telas precisam: carteira, rede, resumo do contrato e registros.
export function useDados() {
  const [conta, setConta] = useState(null);
  const [redeCorreta, setRedeCorreta] = useState(false);
  const [chainIdAtual, setChainIdAtual] = useState(null);
  const [resumo, setResumo] = useState(null);
  const [registros, setRegistros] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState("");
  const [agoraMs, setAgoraMs] = useState(Date.now());

  const enderecoValido = isAddress(CONTRACT_ADDRESS);

  // Relógio: reavalia prazos e janelas a cada 15 s
  useEffect(() => {
    const t = setInterval(() => setAgoraMs(Date.now()), 15000);
    return () => clearInterval(t);
  }, []);

  // Com MetaMask, lê por ela; sem MetaMask, lê por um nó público (só leitura)
  const criarProvider = () =>
    window.ethereum
      ? new BrowserProvider(window.ethereum)
      : new JsonRpcProvider(RPC_PUBLICO, CHAIN_ID, { staticNetwork: true });

  const lerContrato = useCallback(async () => new Contract(CONTRACT_ADDRESS, abi, criarProvider()), []);

  const obterContrato = useCallback(async () => {
    const provider = new BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    return new Contract(CONTRACT_ADDRESS, abi, signer);
  }, []);

  // Contrato de candidatura (só existe depois do deploy v5)
  const gestaoValida = isAddress(GESTAO_ADDRESS);
  const lerGestao = useCallback(async () => new Contract(GESTAO_ADDRESS, abiGestao, criarProvider()), []);
  const obterGestao = useCallback(async () => {
    const provider = new BrowserProvider(window.ethereum);
    return new Contract(GESTAO_ADDRESS, abiGestao, await provider.getSigner());
  }, []);

  // { silencioso: true } = releitura automática em segundo plano: não mostra "carregando" nem troca a
  // mensagem de erro por uma falha passageira de rede. (Checa "=== true" porque às vezes a função é
  // usada direto num onClick e recebe o evento do clique como argumento.)
  const atualizar = useCallback(async (opcoes) => {
    const silencioso = opcoes?.silencioso === true;
    if (!silencioso) {
      setCarregando(true);
      setErro("");
    }
    try {
      const provider = criarProvider();
      const rede = await provider.getNetwork();
      const certa = Number(rede.chainId) === CHAIN_ID;
      setChainIdAtual(Number(rede.chainId));
      setRedeCorreta(certa);

      let contaAtual = null;
      if (window.ethereum) {
        const contas = await window.ethereum.request({ method: "eth_accounts" });
        contaAtual = contas[0] || null;
      }
      setConta(contaAtual);

      if (!certa || !enderecoValido) {
        setResumo(null);
        setRegistros([]);
        return;
      }
      const contrato = new Contract(CONTRACT_ADDRESS, abi, provider);
      setResumo(await carregarResumo(contrato, contaAtual));
      setRegistros(await carregarRegistros(contrato, contaAtual));
      setAgoraMs(Date.now());
    } catch (e) {
      console.error(e);
      if (!silencioso) setErro("Não foi possível ler o contrato. Confira o endereço (deployment.json) e a rede.");
    } finally {
      if (!silencioso) setCarregando(false);
    }
  }, [enderecoValido]);

  // Releitura automática: a blockchain muda sem o site saber (a IA grava o veredito, outros jurados votam,
  // o serviço encerra a votação). A cada 30 s, só com a aba visível, e de novo ao voltar para a aba.
  useEffect(() => {
    let rodando = false;
    const reler = async () => {
      if (rodando || document.visibilityState !== "visible") return;
      rodando = true;
      try { await atualizar({ silencioso: true }); } finally { rodando = false; }
    };
    const t = setInterval(reler, 30000);
    document.addEventListener("visibilitychange", reler);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", reler);
    };
  }, [atualizar]);

  async function conectar() {
    setErro("");
    if (!window.ethereum) {
      setErro("MetaMask não encontrada. Instale a extensão e recarregue a página.");
      return;
    }
    try {
      await new BrowserProvider(window.ethereum).send("eth_requestAccounts", []);
      await atualizar();
    } catch (e) {
      console.error(e);
      setErro("A conexão foi cancelada ou falhou.");
    }
  }

  // Abre a escolha de contas da MetaMask (para liberar várias contas de uma vez)
  async function escolherContas() {
    setErro("");
    try {
      await window.ethereum.request({ method: "wallet_requestPermissions", params: [{ eth_accounts: {} }] });
      await atualizar();
    } catch (e) {
      console.error(e);
      if (e.code !== 4001) setErro("Não consegui abrir a escolha de contas na MetaMask.");
    }
  }

  async function trocarParaSepolia() {
    setErro("");
    try {
      await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CHAIN_ID_HEX }] });
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
                rpcUrls: [RPC_PUBLICO],
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

  // Primeira leitura e reação às trocas de conta/rede na MetaMask
  useEffect(() => {
    atualizar();
    if (!window.ethereum) return;
    const aoTrocar = () => atualizar();
    window.ethereum.on("accountsChanged", aoTrocar);
    window.ethereum.on("chainChanged", aoTrocar);
    return () => {
      window.ethereum.removeListener("accountsChanged", aoTrocar);
      window.ethereum.removeListener("chainChanged", aoTrocar);
    };
  }, [atualizar]);

  return {
    conta,
    redeCorreta,
    chainIdAtual,
    resumo,
    registros,
    carregando,
    erro,
    enderecoValido,
    agoraMs,
    agora: Math.floor(agoraMs / 1000),
    euSouRevisor: !!resumo?.euSouRevisor,
    atualizar,
    conectar,
    escolherContas,
    trocarParaSepolia,
    lerContrato,
    obterContrato,
    gestaoValida,
    lerGestao,
    obterGestao,
  };
}
