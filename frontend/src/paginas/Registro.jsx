import { useEffect, useState } from "react";
import { ST } from "../dados";
import { Aviso, BarraVotos, Ir, irPara } from "../componentes";
import {
  TIPOS, VEREDITOS, abreviar, anexarFonte, carregarFontes, definitivo, executar, formatarData, formatarDia,
  mensagemDeErro, restante, statusDe,
} from "../oathchain";
import { CONTRACT_ADDRESS, EXPLORADOR, NOME_DA_REDE } from "../config";
import { MAP } from "../mapa-brasil";
import { PainelIA, PainelJuri } from "../paineis";

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
        <Ir className="main-btn" para="explorar/lista">Voltar para Explorar</Ir>
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
  const modoJuri = !!r.juri && r.juri.tamanho > 0;
  // Com júri e voto secreto, o voto passa pelo painel do júri (selar e revelar), não pelo botão de votar
  const podeVotar = r.estado === 1 && !modoJuri && janelaAberta && r.euPossoVotar && r.meuVoto === 0;
  const todosRevelaram = modoJuri && r.juri.sorteado && r.reveladosPart >= r.juri.jurados.length + r.juri.observadores.length;
  const podeFinalizar = r.estado === 1 && (modoJuri ? r.juri.sorteado && (!janelaAberta || todosRevelaram) : temMaioria || !janelaAberta || r.totalVotos >= total);
  const podeContestar = r.estado === 2 && r.rodada < 3 && agora < r.fimContestacao && (r.euSouAutor ? !r.autorJaContestou : r.euSouRevisor);
  const podeAnexar = !!d.conta && (r.estado === 0 || (r.estado === 1 && r.euPossoVotar));

  const textoVeredito = r.estado === 2 ? VEREDITOS[r.resultado] : r.estado === 3 ? "Sem consenso" : r.estado === 1 ? "Em votação" : r.estado === 4 ? `Provisório: ${VEREDITOS[r.ia?.veredito || 0]}` : r.tipo === 0 ? "Aguardando a IA" : "Aguardando verificação";
  let chip = "";
  if (r.estado === 2) chip = def ? "Definitivo" : `Em contestação · faltam ${restante(r.fimContestacao, agora)}`;
  else if (r.estado === 4) chip = r.ia && agora < r.ia.fimRevisao ? `Janela de recurso · faltam ${restante(r.ia.fimRevisao, agora)}` : "Ninguém recorreu · confirmando";
  else if (r.estado === 1) chip = todosRevelaram ? "Todos votaram · encerrando" : r.fimVotacao ? `Votação até ${formatarData(r.fimVotacao)}` : "Aguardando o sorteio do júri";
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

  // Linha de etapas: o que já aconteceu, o que está acontecendo agora e o que falta
  const temIA = !!r.ia;
  const temJuri = !!r.juri && r.juri.tamanho > 0;
  const feitoIA = r.tipo === 0 ? temIA || r.estado !== 0 : prazoVenceu;
  const etapas = [
    { t: "Registrado", s: formatarDia(r.criadoEm), feito: true },
    r.tipo === 0
      ? { t: temIA ? "IA verificou" : "Verificação da IA", s: temIA ? `${VEREDITOS[r.ia.veredito]} · ${r.ia.confianca}%` : r.estado === 0 ? "os agentes estão analisando" : "pulada", feito: feitoIA, agora: r.estado === 0 }
      : { t: "Prazo da promessa", s: formatarDia(r.prazo), feito: prazoVenceu, agora: r.estado === 0 },
    r.estado === 4
      ? { t: "Janela de recurso", s: chip, agora: true }
      : { t: "Revisores", s: r.estado === 1 ? (todosRevelaram ? "todos votaram" : temJuri && !r.juri.sorteado ? "sorteando o júri" : "votação aberta") : r.estado >= 2 ? (r.totalVotos > 0 ? `${r.totalVotos} votos` : "ninguém recorreu") : "se alguém recorrer", feito: r.estado === 2 || r.estado === 3, agora: r.estado === 1 },
    { t: r.estado === 3 ? "Sem consenso" : "Definitivo", s: def ? "gravado para sempre" : r.estado === 2 ? chip : r.estado === 3 ? "nada foi gravado como veredito" : "aguardando", feito: def || r.estado === 3, agora: r.estado === 2 && !def },
  ];
  const nenhumaAcao = !podeAbrir && !podeFinalizar && !podeContestar && !podeVotar;
  const iaEmFoco = r.tipo === 0 && (r.estado === 0 || r.estado === 4);
  const juriEmFoco = r.estado === 1 && temJuri;

  return (
    <>
      <button className="voltar" onClick={() => irPara("explorar/lista")}>
        <span aria-hidden="true">←</span> Voltar para Explorar
      </button>

      <header className="reg-cab">
        <p className="etq">{TIPOS[r.tipo]} nº {r.id} · {r.assunto}{r.subassunto ? ` · ${r.subassunto}` : ""}{r.referencia ? ` · ${r.referencia}` : ""}</p>
        <h1>{r.texto}</h1>
        <p className="mut">
          Registrado por <a href={`${EXPLORADOR}/address/${r.autor}`} target="_blank" rel="noreferrer">{abreviar(r.autor)}</a>
          {r.euSouAutor && " (você)"} em {formatarDia(r.criadoEm)}{local && ` · ${local}`}
        </p>
      </header>

      <ol className="etapas" aria-label="Andamento">
        {etapas.map((e, i) => (
          <li key={i} className={e.feito ? "feito" : e.agora ? "agora" : ""}>
            <span className="etapa-bola" aria-hidden="true">{e.feito ? "✓" : i + 1}</span>
            <span className="etapa-t">{e.t}</span>
            <span className="etapa-s">{e.s}</span>
          </li>
        ))}
      </ol>

      <div className="reg-grade">
        <div className="reg-principal">
          <section className="card reg-veredito">
            <p className="etq" style={{ color: "var(--mut)" }}>Situação</p>
            <p className="reg-v" style={{ color: `var(${ST[chave][1]})` }}>{textoVeredito}</p>
            <span className="selo-st" style={{ "--cor": `var(${ST[chave][1]})` }}>{chip}</span>
            {r.estado === 2 && !def && <p className="mut" style={{ margin: "10px 0 0" }}>Passado o prazo, o veredito fica definitivo.</p>}
            {def && !r.superadaPor && (
              <p className="mut" style={{ margin: "10px 0 0" }}>
                Reflete as provas disponíveis em {formatarDia(r.finalizadoEm)}. Se o fato mudar, registre uma correção que o substitua.
              </p>
            )}
            {(r.tipo === 1 || r.criterios) && (
              <dl>
                {r.tipo === 1 && (<><dt>Prazo da promessa</dt><dd>{formatarDia(r.prazo)}</dd></>)}
                {r.criterios && (<><dt>Critérios</dt><dd>{r.criterios}</dd></>)}
                {r.estado === 2 && (<><dt>Verificado em</dt><dd>{formatarData(r.finalizadoEm)}</dd></>)}
              </dl>
            )}
            {(r.substitui > 0 || r.superadaPor > 0) && (
              <div className="hist">
                <b>Histórico:</b>{" "}
                {r.substitui > 0 && (<>corrige o <Ir className="lk" para={"registro/" + r.substitui}>registro #{r.substitui}</Ir>. </>)}
                {r.superadaPor > 0 && (<>Este registro foi <b>Superado</b> pelo <Ir className="lk" para={"registro/" + r.superadaPor}>registro #{r.superadaPor}</Ir>. Ele continua visível.</>)}
              </div>
            )}
          </section>

          {iaEmFoco && <PainelIA r={r} d={d} />}
          {juriEmFoco && <PainelJuri r={r} d={d} />}

          {temIA && !iaEmFoco && (
            <details className="dobra">
              <summary>Como a IA chegou nisso</summary>
              <div><PainelIA r={r} d={d} /></div>
            </details>
          )}
          {temJuri && !juriEmFoco && r.estado !== 0 && (
            <details className="dobra">
              <summary>Júri desta rodada</summary>
              <div><PainelJuri r={r} d={d} /></div>
            </details>
          )}

          {r.estado !== 0 && r.estado !== 4 && (
            <details className="dobra" open={r.estado === 1 && !temJuri}>
              <summary>Como os revisores votaram <span className="mut">{r.totalVotos > 0 ? `${r.totalVotos} votos` : ""}</span></summary>
              <div>
                <BarraVotos contagem={r.contagem} totalRevisores={total} />
                <p style={{ margin: 0, fontSize: 14 }}>
                  {r.estado === 1 && total > 0 && `Para valer, um veredito precisa de ${necessarios} de ${total} votos (mais da metade).`}
                  {r.estado === 1 && total === 0 && "O júri ainda não foi sorteado."}
                  {r.estado === 2 && total > 0 && `Mais da metade dos ${total} revisores concordou, então o veredito vale.`}
                  {r.estado === 3 && `Nenhum veredito passou de 50% dos ${total} revisores, então nenhum foi gravado.`}
                </p>
                {r.meuVoto > 0 && <p style={{ margin: "6px 0 0", fontSize: 14 }}>Seu voto: <b>{VEREDITOS[r.meuVoto]}</b></p>}
              </div>
            </details>
          )}

          <details className="dobra">
            <summary>Fontes guardadas <span className="mut">{fontes.length > 0 ? fontes.length : ""}</span></summary>
            <div>
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
                <form onSubmit={enviarFonte} className="form-fonte">
                  <input type="text" aria-label="Título da fonte" placeholder="Título da fonte" value={novaFonte.titulo} onChange={(e) => setNovaFonte({ ...novaFonte, titulo: e.target.value })} />
                  <input type="text" aria-label="Link da fonte" placeholder="Link (opcional)" value={novaFonte.link} onChange={(e) => setNovaFonte({ ...novaFonte, link: e.target.value })} />
                  <button className="wallet" type="submit" disabled={ocupado}>Anexar fonte</button>
                </form>
              )}
            </div>
          </details>

          <details className="dobra">
            <summary>Gravado para sempre</summary>
            <div className="stamp">
              Registro <code>#{r.id}</code> · contrato <code>{abreviar(CONTRACT_ADDRESS)}</code> · {NOME_DA_REDE}, rede de testes.<br />
              Ninguém pode editar nem apagar.{" "}
              <a className="lk2" href={`${EXPLORADOR}/address/${CONTRACT_ADDRESS}`} target="_blank" rel="noreferrer">Conferir no Etherscan</a>
            </div>
          </details>
        </div>

        <aside className="reg-lado">
          <section className="card reg-acao">
            <p className="etq">O que você pode fazer agora</p>
            {podeAbrir && (
              <button className="main-btn largo" disabled={ocupado} onClick={() => rodar("abrirVerificacao", [r.id])}>
                {r.tipo === 0 ? "Pular a IA e enviar aos revisores" : "Abrir verificação"}
              </button>
            )}
            {podeFinalizar && <button className="main-btn largo" disabled={ocupado} onClick={() => rodar("finalizar", [r.id])}>Finalizar votação</button>}

            {podeVotar && (
              <div className="reg-votar">
                <input type="text" aria-label="Justificativa" placeholder="Justificativa (opcional)" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
                {r.contagem.map((c) => (
                  <button key={c.veredito} className="wallet largo" disabled={ocupado} onClick={() => rodar("votar", [r.id, c.veredito, justificativa])}>
                    Votar: {VEREDITOS[c.veredito]}
                  </button>
                ))}
              </div>
            )}

            {podeContestar && !abrirContestar && (
              <>
                <p className="mut" style={{ margin: "0 0 12px" }}>Discorda deste veredito? Contestar abre uma nova rodada com outro júri (no máximo 3 rodadas).</p>
                <button className="main-btn largo" onClick={() => setAbrirContestar(true)}>Contestar</button>
              </>
            )}
            {podeContestar && abrirContestar && (
              <div className="reg-votar">
                <p className="mut" style={{ margin: 0 }}>Este veredito já vale. Só conteste se você <b>discorda</b> dele e quer reabrir a votação.</p>
                <input type="text" aria-label="Motivo da contestação" placeholder="Motivo da contestação" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                <button className="main-btn largo" disabled={ocupado} onClick={() => rodar("contestar", [r.id, motivo], () => { setMotivo(""); setAbrirContestar(false); })}>Contestar o veredito</button>
                <button className="wallet largo" onClick={() => setAbrirContestar(false)}>Cancelar</button>
              </div>
            )}

            {nenhumaAcao && (
              <p className="mut" style={{ margin: 0 }}>
                {!d.conta
                  ? "Conecte uma carteira para agir neste registro."
                  : iaEmFoco
                  ? "O próximo passo está no painel da IA, ao lado."
                  : juriEmFoco
                  ? "O voto do júri é feito no painel do júri, ao lado."
                  : def
                  ? "Nada pendente: este registro já é definitivo."
                  : "Nada para você fazer agora. A página se atualiza sozinha."}
              </p>
            )}
            {r.estado === 1 && !modoJuri && janelaAberta && d.conta && !r.euPossoVotar && r.meuVoto === 0 && (
              <p className="nota-v">Só revisores votam, e o autor não vota no próprio registro.</p>
            )}
            {!d.conta && <button className="wallet largo" style={{ marginTop: 12 }} onClick={d.conectar}>Conectar carteira</button>}
            {erro && <Aviso tipo="erro">{erro}</Aviso>}
            {hash && <Aviso tipo="ok">Confirmado! <a className="lk2" href={`${EXPLORADOR}/tx/${hash}`} target="_blank" rel="noreferrer">Ver a transação</a></Aviso>}
          </section>
        </aside>
      </div>
    </>
  );
}
