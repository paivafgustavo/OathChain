import { useEffect, useState } from "react";
import { ST } from "../dados";
import { Aviso, BarraVotos, COR_PAPEL, Ir } from "../componentes";
import {
  TIPOS, VEREDITOS, abreviar, anexarFonte, carregarFontes, definitivo, executar, formatarData, formatarDia,
  mensagemDeErro, restante, statusDe,
} from "../oathchain";
import { CONTRACT_ADDRESS, EXPLORADOR, NOME_DA_REDE } from "../config";
import { MAP } from "../mapa-brasil";

export default function Registro({ d, id }) {
  const r = d.registros.find((x) => x.id === Number(id));
  const [fontes, setFontes] = useState([]);
  const [justificativa, setJustificativa] = useState("");
  const [motivo, setMotivo] = useState("");
  const [novaFonte, setNovaFonte] = useState({ titulo: "", link: "" });
  const [abrirContestar, setAbrirContestar] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [hash, setHash] = useState("");

  useEffect(() => {
    if (!r) return undefined;
    let vivo = true;
    d.lerContrato()
      .then((c) => carregarFontes(c, r.id))
      .then((f) => vivo && setFontes(f))
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [d.registros, id]);

  if (!r) {
    return (
      <>
        <h2>Registro não encontrado</h2>
        <p className="mut">{d.carregando ? "Lendo os registros…" : "Este registro não existe neste contrato."}</p>
        <Ir className="main-btn" para="estante">Voltar à estante</Ir>
      </>
    );
  }

  const agora = d.agora;
  const chave = statusDe(r, agora);
  const def = definitivo(r, agora);
  const total = r.totalRevisores;
  const necessarios = Math.floor(total / 2) + 1;
  const temMaioria = r.contagem.some((c) => c.qtd * 2 > total);
  const janelaAberta = agora < r.fimVotacao;
  const prazoVenceu = agora >= r.prazo;

  const podeAbrir = r.estado === 0 && (r.tipo === 0 ? r.euSouAutor : prazoVenceu) && d.resumo.revisoresAtivos >= d.resumo.minRevisores;
  const podeVotar = r.estado === 1 && janelaAberta && r.euPossoVotar && r.meuVoto === 0;
  const podeFinalizar = r.estado === 1 && (temMaioria || !janelaAberta || r.totalVotos >= total);
  const podeContestar = r.estado === 2 && r.rodada < 3 && agora < r.fimContestacao && (r.euSouAutor ? !r.autorJaContestou : r.euSouRevisor);
  const podeAnexar = !!d.conta && (r.estado === 0 || (r.estado === 1 && r.euPossoVotar));

  const textoVeredito = r.estado === 2 ? VEREDITOS[r.resultado] : r.estado === 3 ? "Sem consenso" : r.estado === 1 ? "Em votação" : "Aguardando verificação";
  let chip = "";
  if (r.estado === 2) chip = def ? "Definitivo" : `Em contestação · faltam ${restante(r.fimContestacao, agora)}`;
  else if (r.estado === 1) chip = `Votação até ${formatarData(r.fimVotacao)}`;
  else if (r.estado === 0) chip = r.tipo === 1 && !prazoVenceu ? `Prazo em ${formatarData(r.prazo)}` : "Aguardando abertura da verificação";
  else chip = "Encerrado sem veredito";

  const local = [r.cidade, r.uf && MAP[r.uf]?.n].filter(Boolean).join(" · ");

  async function rodar(nome, args, depois) {
    setErro("");
    setHash("");
    setOcupado(true);
    try {
      const contrato = await d.obterContrato();
      setHash(await executar(contrato, nome, args));
      depois?.();
      await d.atualizar();
    } catch (e) {
      console.error(e);
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  async function enviarFonte(e) {
    e.preventDefault();
    if (novaFonte.titulo.trim().length < 5) return setErro("Dê um título à fonte (mínimo de 5 caracteres).");
    setErro("");
    setHash("");
    setOcupado(true);
    try {
      const contrato = await d.obterContrato();
      await anexarFonte(contrato, r.id, novaFonte.titulo, novaFonte.link);
      setNovaFonte({ titulo: "", link: "" });
      await d.atualizar();
    } catch (err) {
      console.error(err);
      setErro(mensagemDeErro(err));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <>
      <div className="paper">
        <div className="leaf">
          <small>{TIPOS[r.tipo]} registrada · {r.assunto}{r.subassunto ? ` · ${r.subassunto}` : ""}</small>
          <h2>{r.texto}</h2>
          <div className="verdict" style={{ color: COR_PAPEL[chave] }}>{textoVeredito}</div>
          <span className="chip">{chip}</span>
          {r.estado === 2 && !def && <p style={{ fontSize: 14, margin: "8px 0 0" }}>Passado o prazo, o veredito fica definitivo.</p>}
          {def && !r.superadaPor && (
            <p style={{ fontSize: 14, margin: "8px 0 0" }}>
              Reflete as provas disponíveis em {formatarDia(r.finalizadoEm)}. Se o fato mudar, registre uma correção que o substitua.
            </p>
          )}
          <dl>
            {r.referencia && (<><dt>Válido para</dt><dd>{r.referencia}</dd></>)}
            {r.tipo === 1 && (<><dt>Prazo da promessa</dt><dd>{formatarDia(r.prazo)}</dd></>)}
            {r.criterios && (<><dt>Critérios</dt><dd>{r.criterios}</dd></>)}
            <dt>Autor</dt>
            <dd>
              <a className="lk2" href={`${EXPLORADOR}/address/${r.autor}`} target="_blank" rel="noreferrer">{abreviar(r.autor)}</a>
              {r.euSouAutor && " (você)"}
            </dd>
            <dt>Registrado em</dt><dd>{formatarDia(r.criadoEm)}</dd>
            {local && (<><dt>Local</dt><dd>{local}</dd></>)}
            {r.estado === 2 && (<><dt>Verificado em</dt><dd>{formatarData(r.finalizadoEm)}</dd></>)}
          </dl>
          {(r.substitui > 0 || r.superadaPor > 0) && (
            <div className="hist">
              <b>Histórico:</b>{" "}
              {r.substitui > 0 && (<>corrige o <Ir className="lk" para={"registro/" + r.substitui}>registro #{r.substitui}</Ir>. </>)}
              {r.superadaPor > 0 && (<>Este registro foi <b>Superado</b> pelo <Ir className="lk" para={"registro/" + r.superadaPor}>registro #{r.superadaPor}</Ir>. Ele continua visível.</>)}
            </div>
          )}
        </div>

        <div className="leaf">
          <h3>Como os revisores votaram</h3>
          {r.estado === 0 ? (
            <p className="nota-v">A votação ainda não foi aberta.</p>
          ) : (
            <>
              <BarraVotos contagem={r.contagem} totalRevisores={total} />
              <p style={{ margin: 0, fontSize: 14 }}>
                {r.estado === 1 && `Para valer, um veredito precisa de ${necessarios} de ${total} votos (mais da metade).`}
                {r.estado === 2 && `Mais da metade dos ${total} revisores concordou, então o veredito vale.`}
                {r.estado === 3 && `Nenhum veredito passou de 50% dos ${total} revisores, então nenhum foi gravado.`}
              </p>
              {r.meuVoto > 0 && <p style={{ margin: "6px 0 0", fontSize: 14 }}>Seu voto: <b>{VEREDITOS[r.meuVoto]}</b></p>}
            </>
          )}

          <h3 style={{ marginTop: 18 }}>Fontes guardadas</h3>
          {fontes.length === 0 ? (
            <p className="nota-v">Nenhuma fonte anexada ainda.</p>
          ) : (
            <ul>
              {fontes.map((f, i) => (
                <li key={i}>
                  {f.titulo}
                  {/^https?:\/\//.test(f.link) && (<> · <a className="lk2" href={f.link} target="_blank" rel="noreferrer">abrir</a></>)}{" "}
                  <small>({abreviar(f.anexadaPor)}, {formatarDia(f.data)})</small>
                </li>
              ))}
            </ul>
          )}
          {podeAnexar && (
            <form onSubmit={enviarFonte}>
              <input type="text" placeholder="Título da fonte" value={novaFonte.titulo} onChange={(e) => setNovaFonte({ ...novaFonte, titulo: e.target.value })} />
              <input type="text" placeholder="Link (opcional)" value={novaFonte.link} onChange={(e) => setNovaFonte({ ...novaFonte, link: e.target.value })} />
              <div className="acts"><button className="alt" type="submit" disabled={ocupado}>Anexar fonte</button></div>
            </form>
          )}

          <div className="stamp">
            <b>Gravado para sempre</b><br />
            Registro <code>#{r.id}</code> · contrato <code>{abreviar(CONTRACT_ADDRESS)}</code><br />
            {NOME_DA_REDE} · rede de testes<br />
            <small>Ninguém pode editar nem apagar.</small>{" "}
            <a className="lk2" href={`${EXPLORADOR}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">Ver no Etherscan</a>
          </div>

          {/* Ações */}
          <div className="acts" style={{ flexWrap: "wrap" }}>
            {podeAbrir && <button disabled={ocupado} onClick={() => rodar("abrirVerificacao", [r.id])}>Abrir verificação</button>}
            {podeFinalizar && <button disabled={ocupado} onClick={() => rodar("finalizar", [r.id])}>Finalizar votação</button>}
            {podeContestar && !abrirContestar && <button className="alt" onClick={() => setAbrirContestar(true)}>Discorda deste veredito?</button>}
          </div>

          {podeVotar && (
            <div>
              <input type="text" placeholder="Justificativa (opcional)" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
              <div className="acts" style={{ flexWrap: "wrap" }}>
                {r.contagem.map((c) => (
                  <button key={c.veredito} disabled={ocupado} onClick={() => rodar("votar", [r.id, c.veredito, justificativa])}>
                    Votar: {VEREDITOS[c.veredito]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {podeContestar && abrirContestar && (
            <div>
              <p style={{ fontSize: 14, margin: "10px 0 0" }}>
                Este veredito já vale. Só conteste se você <b>discorda</b> dele e quer reabrir a votação.
              </p>
              <input type="text" placeholder="Motivo da contestação" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
              <div className="acts">
                <button disabled={ocupado} onClick={() => rodar("contestar", [r.id, motivo], () => { setMotivo(""); setAbrirContestar(false); })}>Contestar o veredito</button>
                <button className="alt" onClick={() => setAbrirContestar(false)}>Cancelar</button>
              </div>
            </div>
          )}

          {r.estado === 1 && janelaAberta && d.conta && !r.euPossoVotar && r.meuVoto === 0 && (
            <p className="nota-v" style={{ color: "inherit" }}>Só revisores votam, e o autor não vota no próprio registro.</p>
          )}
          {!d.conta && <p className="nota-v" style={{ color: "inherit" }}>Conecte uma carteira para agir neste registro.</p>}
          {erro && <Aviso tipo="erro">{erro}</Aviso>}
          {hash && <Aviso tipo="ok">Confirmado! <a className="lk2" href={`${EXPLORADOR}/tx/${hash}`} target="_blank" rel="noreferrer">Ver a transação</a></Aviso>}
        </div>
      </div>
      <Ir className="main-btn" para="linha">Ver na linha do tempo</Ir>
    </>
  );
}
