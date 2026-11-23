// Painéis da página de um registro: verificação automática (IA) e júri sorteado com voto secreto.
import { useEffect, useState } from "react";
import { AbiCoder, keccak256, toUtf8Bytes } from "ethers";
import { Aviso } from "./componentes";
import { VEREDITOS, abreviar, executar, formatarData, mensagemDeErro, restante } from "./oathchain";
import { BLOCO_INICIAL, CONTRACT_ADDRESS, EXPLORADOR } from "./config";

// Relatório no IPFS (ipfs://CID): tenta vários gateways públicos. Qualquer um serve, porque o hash
// do texto é conferido com o da blockchain logo depois; um gateway desonesto seria pego na hora.
// A Pinata vem primeiro: é onde o serviço guarda o arquivo, então responde na hora; os outros são reserva.
const GATEWAYS_IPFS = ["https://gateway.pinata.cloud/ipfs/", "https://ipfs.io/ipfs/", "https://dweb.link/ipfs/"];

async function baixarTexto(url) {
  const urls = url.startsWith("ipfs://") ? GATEWAYS_IPFS.map((g) => g + url.slice(7)) : [url];
  let ultimoErro;
  for (const u of urls) {
    try {
      const resp = await fetch(u, { signal: AbortSignal.timeout(15000) });
      if (resp.ok) return await resp.text();
      ultimoErro = new Error("O servidor respondeu " + resp.status);
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw ultimoErro;
}

const NOMES_AGENTES = { "Avaliador de fontes": "Avaliador de fontes", Analista: "Analista", Contraditor: "Contraditor" };

// ---------------------------------------------------------------
// Verificação automática (IA)
// ---------------------------------------------------------------
export function PainelIA({ r, d }) {
  const [rel, setRel] = useState(null); // { texto, dados, confere }
  const [falha, setFalha] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const ia = r.ia;
  const agora = d.agora;

  async function baixar() {
    setFalha("");
    try {
      const texto = await baixarTexto(ia.urlRelatorio);
      // Prova de que o relatório não foi alterado: o hash do texto precisa ser igual ao gravado na blockchain
      const confere = keccak256(toUtf8Bytes(texto)) === ia.hashRelatorio;
      setRel({ texto, dados: JSON.parse(texto), confere });
    } catch (e) {
      console.error(e);
      setFalha("Não consegui baixar o relatório (o serviço de IA pode estar desligado). O hash continua gravado na blockchain.");
    }
  }

  useEffect(() => {
    setRel(null);
  }, [r.id]);

  if (!ia) {
    if (r.tipo === 0 && r.estado === 0) {
      return (
        <div className="card painel">
          <h3>Verificação automática</h3>
          <p className="mut" style={{ margin: 0 }}>
            Aguardando os 4 agentes de IA. Quando terminarem, o veredito aparece aqui como <b>provisório</b> e os revisores podem recorrer.
          </p>
        </div>
      );
    }
    return null;
  }

  const provisoria = r.estado === 4;
  const janelaAberta = agora < ia.fimRevisao;
  const podeRecorrer = provisoria && janelaAberta && (r.euSouAutor || r.euSouRevisor);
  const podeConfirmar = provisoria && !janelaAberta;

  async function agir(nome, args) {
    setErro("");
    setOcupado(true);
    try {
      await executar(await d.obterContrato(), nome, args);
      await d.atualizar();
    } catch (e) {
      console.error(e);
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="card painel">
      <h3>Verificação automática: 4 agentes de IA</h3>
      <p style={{ margin: "0 0 8px" }}>
        A IA concluiu <b>{VEREDITOS[ia.veredito]}</b> com <b>{ia.confianca}%</b> de confiança em {formatarData(ia.em)}.
        {provisoria && " Este veredito é PROVISÓRIO: humanos podem recorrer até o fim da janela."}
        {!provisoria && r.estado === 1 && " A confiança foi baixa (ou a IA ficou inconclusiva), então a decisão passou direto para o júri humano."}
        {r.estado === 2 && " O veredito final ficou como foi decidido (pela IA sem recurso, ou pelos humanos)."}
      </p>
      <div className="barra-conf" role="img" aria-label={`Confiança ${ia.confianca}%`}>
        <i style={{ width: ia.confianca + "%" }} />
      </div>
      <p className="nota-v" style={{ color: "inherit" }}>
        Hash do relatório gravado na blockchain: <code>{abreviar(ia.hashRelatorio)}</code>
      </p>

      {provisoria && (
        <p style={{ margin: "8px 0" }}>
          {janelaAberta ? <>Janela de recurso: faltam <b>{restante(ia.fimRevisao, agora)}</b>.</> : "A janela de recurso terminou sem recurso."}
        </p>
      )}

      <div className="acts2">
        <button onClick={baixar} disabled={!!rel}>Ler o relatório e conferir o hash</button>
        {podeConfirmar && <button className="main-btn peq" disabled={ocupado} onClick={() => agir("confirmarIA", [r.id])}>Confirmar veredito da IA</button>}
      </div>

      {podeRecorrer && (
        <div style={{ marginTop: 10 }}>
          <input type="text" placeholder="Por que a IA errou? (motivo do recurso)" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <div className="acts2">
            <button className="main-btn peq" disabled={ocupado || motivo.trim().length < 5} onClick={() => agir("recorrerDaIA", [r.id, motivo])}>
              Recorrer: enviar para o júri humano
            </button>
          </div>
          <small>O recurso não gasta a contestação do autor.</small>
        </div>
      )}
      {provisoria && janelaAberta && !podeRecorrer && (
        <p className="nota-v" style={{ color: "inherit" }}>Só o autor ou um revisor pode recorrer.</p>
      )}

      {falha && <Aviso tipo="erro">{falha}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}

      {rel && (
        <div className="relatorio">
          <Aviso tipo={rel.confere ? "ok" : "erro"}>
            {rel.confere
              ? "Relatório íntegro: o hash do texto baixado é idêntico ao gravado na blockchain."
              : "Atenção: o texto baixado NÃO bate com o hash da blockchain. Não confie neste relatório."}
          </Aviso>
          {rel.dados.simulado && <Aviso>Este relatório foi gerado em MODO DEMONSTRAÇÃO (respostas simuladas).</Aviso>}
          {rel.dados.filtro && !rel.dados.filtro.verificavel && (
            <Aviso>
              O filtro de fato vs. opinião classificou o texto como <b>{rel.dados.filtro.tipo === "previsao" ? "previsão" : "opinião"}</b>
              {" "}({rel.dados.filtro.motivos.join("; ")}). Os agentes não foram chamados e a decisão fica com o júri humano.
            </Aviso>
          )}
          <h4>Como cada agente votou</h4>
          <ul className="agentes">
            {rel.dados.resultado.votos.map((v) => (
              <li key={v.agente}>
                <b>{NOMES_AGENTES[v.agente] || v.agente}</b>: {v.veredito} ({v.confianca}%)
              </li>
            ))}
          </ul>
          {rel.dados.resultado.motivos.length > 0 && (
            <p style={{ fontSize: 14 }}>Ajustes da regra de consolidação: {rel.dados.resultado.motivos.join(" ")}</p>
          )}
          <details>
            <summary>Pesquisador: o que foi buscado ({rel.dados.evidencias.length} fontes)</summary>
            <p className="mut" style={{ fontSize: 14 }}>Consultas: {rel.dados.consultas.join(" · ")}</p>
            <ul>
              {rel.dados.evidencias.map((e) => {
                const nota = rel.dados.agentes.avaliadorDeFontes.fontes?.find((f) => f.id === e.id);
                return (
                  <li key={e.id}>
                    {/^https?:\/\//.test(e.url || "") ? (
                      <a className="lk2" href={e.url} target="_blank" rel="noreferrer">{e.titulo}</a>
                    ) : e.titulo}{" "}
                    <small>({e.origem}{nota ? ` · credibilidade ${nota.credibilidade}` : ""})</small>
                  </li>
                );
              })}
            </ul>
          </details>
          <details>
            <summary>Resumo do analista ({rel.dados.especialidade}) e objeções do contraditor</summary>
            <p style={{ fontSize: 14 }}>{rel.dados.agentes.analista.resumo}</p>
            {(rel.dados.agentes.contraditor.objecoes || []).length > 0 && (
              <ul>{rel.dados.agentes.contraditor.objecoes.map((o, i) => <li key={i}>{o}</li>)}</ul>
            )}
          </details>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------
// Júri sorteado e voto secreto
// ---------------------------------------------------------------
const codificar = (v, sal, quem, id, rodada) =>
  keccak256(AbiCoder.defaultAbiCoder().encode(["uint8", "bytes32", "address", "uint256", "uint32"], [v, sal, quem, id, rodada]));

// O "sal" é derivado da assinatura da carteira: se a pessoa fechar a página, é só assinar de novo
// e o mesmo sal volta (a assinatura da MetaMask é determinística). Nada precisa ser guardado.
async function gerarSal(contrato, id, rodada) {
  const msg = `OathChain voto secreto\ncontrato:${CONTRACT_ADDRESS}\nregistro:${id}\nrodada:${rodada}`;
  return keccak256(toUtf8Bytes(await contrato.runner.signMessage(msg)));
}

export function PainelJuri({ r, d }) {
  const j = r.juri;
  const [veredito, setVeredito] = useState(0);
  const [just, setJust] = useState("");
  const [link, setLink] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [ok, setOk] = useState("");
  const [revelados, setRevelados] = useState([]);
  const agora = d.agora;

  const vs = r.contagem.map((c) => c.veredito);

  // Votos já revelados (leitura dos eventos do contrato)
  useEffect(() => {
    if (!j?.sorteado) return undefined;
    let vivo = true;
    d.lerContrato()
      .then((c) => c.queryFilter(c.filters.VotoRevelado(r.id), BLOCO_INICIAL || 0))
      .then((ev) => vivo && setRevelados(ev.filter((e) => Number(e.args.rodada) === r.rodada).map((e) => e.args)))
      .catch(() => {});
    return () => { vivo = false; };
  }, [r.id, r.rodada, r.reveladosPart, j?.sorteado]);

  if (!j || j.tamanho === 0) return null;

  const fase = !j.sorteado ? "sorteio" : !j.secreto ? (agora < r.fimVotacao ? "votar" : "encerrada") : agora < j.fimCompromisso ? "selar" : agora < r.fimVotacao ? "revelar" : "encerrada";
  const souJuradoOuAprendiz = r.meuPapel !== 0;
  const jaSelou = !!r.meuSelo;
  const jaRevelou = r.meuVoto > 0;
  const rotuloPapel = r.meuPapel === 1 ? "jurado (seu voto conta)" : r.meuPapel === 2 ? "aprendiz (observador: seu voto não conta no resultado, mas conta como prova)" : "";

  async function agir(fn) {
    setErro("");
    setOk("");
    setOcupado(true);
    try {
      await fn(await d.obterContrato());
      await d.atualizar();
    } catch (e) {
      console.error(e);
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  const sortear = () => agir((c) => executar(c, "sortearJurados", [r.id]));

  const selar = () =>
    agir(async (c) => {
      if (!veredito) throw { shortMessage: "Escolha um veredito." };
      const sal = await gerarSal(c, r.id, r.rodada);
      await executar(c, "comprometerVoto", [r.id, codificar(veredito, sal, d.conta, BigInt(r.id), r.rodada)]);
      setOk("Voto selado! Ninguém vê o que você escolheu. Volte na etapa de revelar.");
    });

  // Voto aberto: veredito, justificativa e link vão juntos, numa única transação.
  const votarAberto = () =>
    agir(async (c) => {
      if (!veredito) throw { shortMessage: "Escolha um veredito." };
      if (just.trim().length < 40) throw { shortMessage: "A justificativa precisa ter pelo menos 40 caracteres." };
      if (!/^https?:\/\/.{6,}/.test(link.trim())) throw { shortMessage: "Informe o link (http...) da fonte que sustenta o seu voto." };
      await executar(c, "votarComJustificativa", [r.id, veredito, just.trim(), link.trim()]);
      setOk(`Voto registrado: ${VEREDITOS[veredito]}.`);
    });

  const revelar = () =>
    agir(async (c) => {
      if (just.trim().length < 40) throw { shortMessage: "A justificativa precisa ter pelo menos 40 caracteres." };
      if (!/^https?:\/\/.{6,}/.test(link.trim())) throw { shortMessage: "Informe o link (http...) da fonte que sustenta o seu voto." };
      const sal = await gerarSal(c, r.id, r.rodada);
      // descobre qual veredito foi selado (assim não precisamos guardar nada no navegador)
      const escolhido = vs.find((v) => codificar(v, sal, d.conta, BigInt(r.id), r.rodada).toLowerCase() === r.meuSelo.toLowerCase());
      if (!escolhido) throw { shortMessage: "Não consegui reconstruir o seu voto selado. Use a mesma carteira que selou." };
      await executar(c, "revelarVoto", [r.id, escolhido, sal, just.trim(), link.trim()]);
      setOk(`Voto revelado: ${VEREDITOS[escolhido]}.`);
    });

  return (
    <div className="card painel">
      <h3>Júri sorteado ·{j.secreto ? "voto secreto" : "voto aberto com justificativa"}</h3>
      <ol className="fases">
        <li className={fase === "sorteio" ? "on" : "feito"}>1. Sorteio</li>
        {j.secreto ? (
          <>
            <li className={fase === "selar" ? "on" : fase === "sorteio" ? "" : "feito"}>2. Selar voto</li>
            <li className={fase === "revelar" ? "on" : fase === "encerrada" ? "feito" : ""}>3. Revelar</li>
            <li className={fase === "encerrada" ? "on" : ""}>4. Resultado</li>
          </>
        ) : (
          <>
            <li className={fase === "votar" ? "on" : fase === "sorteio" ? "" : "feito"}>2. Votar e justificar</li>
            <li className={fase === "encerrada" ? "on" : ""}>3. Resultado</li>
          </>
        )}
      </ol>

      {fase === "sorteio" && (
        <>
          <p style={{ margin: "0 0 8px" }}>
            O júri ({j.tamanho} revisores{j.aprendizes ? ` + até ${j.aprendizes} aprendizes` : ""}) é sorteado com o hash de um bloco que ainda não existia quando a verificação foi aberta (bloco {j.bloco}).
            Ninguém consegue escolher os jurados, nem o autor. Qualquer pessoa pode acionar o sorteio.
          </p>
          <div className="acts2"><button className="main-btn peq" disabled={ocupado || !d.conta} onClick={sortear}>Sortear jurados</button></div>
          <small>Se o botão recusar, o bloco do sorteio ainda não chegou: aguarde alguns segundos.</small>
        </>
      )}

      {j.sorteado && (
        <>
          <p style={{ margin: "0 0 6px" }}>
            <b>Jurados sorteados:</b> {j.jurados.map((a) => abreviar(a)).join(", ")}
            {j.observadores.length > 0 && <><br /><b>Aprendizes observando:</b> {j.observadores.map((a) => abreviar(a)).join(", ")}</>}
          </p>
          {fase === "votar" && <p style={{ margin: "0 0 6px" }}>A votação termina em {formatarData(r.fimVotacao)} (faltam {restante(r.fimVotacao, agora)}). Sorteado que não votar leva uma falta.</p>}
          {fase === "selar" && <p style={{ margin: "0 0 6px" }}>Etapa de selar termina em {formatarData(j.fimCompromisso)} (faltam {restante(j.fimCompromisso, agora)}).</p>}
          {fase === "revelar" && <p style={{ margin: "0 0 6px" }}>Etapa de revelar termina em {formatarData(r.fimVotacao)} (faltam {restante(r.fimVotacao, agora)}). Sorteado que não revelar leva uma falta.</p>}
          <p className="nota-v" style={{ color: "inherit" }}>{j.secreto ? "Revelaram" : "Votaram"} até agora: {r.reveladosPart} de {j.jurados.length + j.observadores.length}.</p>

          {souJuradoOuAprendiz && <p style={{ margin: "6px 0" }}>Você foi sorteado como <b>{rotuloPapel}</b>.</p>}

          {!j.secreto && souJuradoOuAprendiz && fase === "votar" && !jaRevelou && (
            <div>
              <div className="opcoes">
                {vs.map((v) => (
                  <label key={v}><input type="radio" name="vd" checked={veredito === v} onChange={() => setVeredito(v)} /> {VEREDITOS[v]}</label>
                ))}
              </div>
              <textarea rows={3} placeholder="Justificativa (mínimo de 40 caracteres): o que você encontrou nas fontes?" value={just} onChange={(e) => setJust(e.target.value)} />
              <input type="text" placeholder="Link da fonte que sustenta o seu voto (https://...)" value={link} onChange={(e) => setLink(e.target.value)} />
              <div className="acts2"><button className="main-btn peq" disabled={ocupado || !veredito} onClick={votarAberto}>Votar</button></div>
              <small>Voto e justificativa vão juntos, numa só transação. Os votos já dados aparecem abaixo: decida pelas fontes, não pela maioria. Discordar não custa nada; só não votar custa.</small>
            </div>
          )}
          {j.secreto && souJuradoOuAprendiz && fase === "selar" && !jaSelou && (
            <div>
              <div className="opcoes">
                {vs.map((v) => (
                  <label key={v}><input type="radio" name="vd" checked={veredito === v} onChange={() => setVeredito(v)} /> {VEREDITOS[v]}</label>
                ))}
              </div>
              <div className="acts2">
                <button className="main-btn peq" disabled={ocupado || !veredito} onClick={selar}>Selar meu voto</button>
              </div>
              <small>Pesquise as fontes e decida por conta própria. Discordar da maioria não custa nada: só não participar custa.</small>
            </div>
          )}
          {j.secreto && souJuradoOuAprendiz && fase === "selar" && jaSelou && <Aviso tipo="ok">Seu voto está selado. Volte na etapa de revelar.</Aviso>}
          {j.secreto && souJuradoOuAprendiz && fase === "revelar" && !jaSelou && <Aviso>Você não selou um voto a tempo, então não pode revelar.</Aviso>}
          {j.secreto && souJuradoOuAprendiz && fase === "revelar" && jaSelou && !jaRevelou && (
            <div>
              <textarea rows={3} placeholder="Justificativa (mínimo de 40 caracteres): o que você encontrou nas fontes?" value={just} onChange={(e) => setJust(e.target.value)} />
              <input type="text" placeholder="Link da fonte que sustenta o seu voto (https://...)" value={link} onChange={(e) => setLink(e.target.value)} />
              <div className="acts2"><button className="main-btn peq" disabled={ocupado} onClick={revelar}>Revelar meu voto</button></div>
              <small>A MetaMask vai pedir uma assinatura (sem custo) para recuperar o segredo do seu voto.</small>
            </div>
          )}
          {jaRevelou && <p style={{ margin: "6px 0" }}>Seu voto revelado: <b>{VEREDITOS[r.meuVoto]}</b>.</p>}
          {!souJuradoOuAprendiz && d.conta && <p className="nota-v" style={{ color: "inherit" }}>Você não está neste júri. Pode acompanhar tudo aqui.</p>}

          {revelados.length > 0 && (
            <details open>
              <summary>{j.secreto ? "Votos revelados" : "Votos"} e fundamentação ({revelados.length})</summary>
              <ul className="agentes">
                {revelados.map((v, i) => (
                  <li key={i}>
                    <b>{abreviar(v.quem)}</b> ({Number(v.papel) === 1 ? "jurado" : "aprendiz"}): {VEREDITOS[Number(v.voto)]}
                    <br /><span style={{ fontSize: 14 }}>{v.justificativa}</span>{" "}
                    {/^https?:\/\//.test(v.linkFonte) && <a className="lk2" href={v.linkFonte} target="_blank" rel="noreferrer">fonte</a>}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
      {ok && <Aviso tipo="ok">{ok}</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <small><a className="lk2" href={`${EXPLORADOR}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">Auditar no Etherscan</a></small>
    </div>
  );
}
