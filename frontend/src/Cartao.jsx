import { useState } from "react";
import {
  TIPOS,
  ESTADOS,
  VEREDITOS,
  abreviar,
  formatarData,
  lerConteudo,
  executar,
  mensagemDeErro,
} from "./oathchain";
import { EXPLORADOR } from "./config";

export default function Cartao({ r, conta, minRevisores, revisoresAtivos, agoraMs, obterContrato, aoConcluir }) {
  const [justificativa, setJustificativa] = useState("");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [hash, setHash] = useState("");
  const [mostrarContestar, setMostrarContestar] = useState(false);

  const conteudo = lerConteudo(r.cidConteudo);
  const agora = Math.floor(agoraMs / 1000);

  // --- situação do registro ---
  const total = r.totalRevisores;
  const necessarios = Math.floor(total / 2) + 1; // mais de 50%
  const temMaioria = r.contagem.some((c) => c.qtd * 2 > total);
  const janelaAberta = agora < r.fimVotacao;

  // --- o que a conta conectada pode fazer ---
  const prazoVenceu = agora >= r.prazo;
  const podeAbrir =
    r.estado === 0 &&
    (r.tipo === 0 ? r.euSouAutor : prazoVenceu) &&
    revisoresAtivos >= minRevisores;
  const podeVotar = r.estado === 1 && janelaAberta && r.euPossoVotar && r.meuVoto === 0;
  const podeFinalizar = r.estado === 1 && (temMaioria || !janelaAberta || r.totalVotos >= total);
  const podeContestar =
    r.estado === 2 &&
    r.rodada < 3 &&
    (r.euSouAutor ? !r.autorJaContestou : r.euSouRevisor);

  async function rodar(nome, argumentos) {
    setErro("");
    setHash("");
    setOcupado(true);
    try {
      const contrato = await obterContrato();
      setHash(await executar(contrato, nome, argumentos));
      setJustificativa("");
      setMotivo("");
      await aoConcluir();
    } catch (e) {
      console.error(e);
      setErro(mensagemDeErro(e));
    } finally {
      setOcupado(false);
    }
  }

  return (
    <article className="cartao">
      <div className="cartao-topo">
        <span className="id">#{r.id}</span>
        <span className={"selo tipo" + r.tipo}>{TIPOS[r.tipo]}</span>
        <span className={"selo estado" + r.estado}>{ESTADOS[r.estado]}</span>
      </div>

      <p className="conteudo">{conteudo.texto}</p>
      {conteudo.criterios && (
        <p className="criterios">
          <strong>Critérios:</strong> {conteudo.criterios}
        </p>
      )}

      <dl className="detalhes">
        <div>
          <dt>Autor</dt>
          <dd>
            <a href={`${EXPLORADOR}/address/${r.autor}`} target="_blank" rel="noreferrer">
              {abreviar(r.autor)}
            </a>
            {r.euSouAutor && " (você)"}
          </dd>
        </div>
        <div>
          <dt>Registrado em</dt>
          <dd>{formatarData(r.criadoEm)}</dd>
        </div>
        {r.tipo === 1 && (
          <div>
            <dt>Prazo da promessa</dt>
            <dd>{formatarData(r.prazo)}</dd>
          </div>
        )}
        {r.rodada > 1 && (
          <div>
            <dt>Contestações</dt>
            <dd>
              {r.rodada - 1} de 2 usadas
              {r.estado === 2 && r.rodada === 3 && " (limite atingido)"}
            </dd>
          </div>
        )}
        {r.estado === 1 && (
          <div>
            <dt>Votação até</dt>
            <dd>{formatarData(r.fimVotacao)}</dd>
          </div>
        )}
        {r.estado === 2 && (
          <div>
            <dt>Veredito</dt>
            <dd className="veredito">✅ {VEREDITOS[r.resultado]}</dd>
          </div>
        )}
      </dl>

      {r.estado === 3 && (
        <p className="nota-estado">
          Nenhum veredito alcançou mais de 50% dos revisores, então <strong>nenhum veredito foi
          gravado</strong> para este registro.
        </p>
      )}

      {r.estado === 0 && r.tipo === 1 && !prazoVenceu && (
        <p className="nota-estado">A verificação só pode ser aberta depois do prazo da promessa.</p>
      )}
      {r.estado === 0 && r.tipo === 0 && !r.euSouAutor && (
        <p className="nota-estado">Só o autor abre a verificação de uma afirmação.</p>
      )}
      {r.estado === 0 && revisoresAtivos < minRevisores && (
        <p className="nota-estado">Faltam revisores cadastrados para abrir a verificação.</p>
      )}

      {/* Placar da rodada */}
      {(r.estado === 1 || r.estado === 2 || r.estado === 3) && (
        <div className="placar">
          <div className="placar-titulo">
            {r.rodada > 1 ? `Votação após contestação (rodada ${r.rodada})` : "Votação"}: {r.totalVotos} de{" "}
            {total} revisores votaram
            {r.estado === 1 && ` · maioria = ${necessarios} votos iguais`}
          </div>
          <div className="placar-linhas">
            {r.contagem.map((c) => (
              <span key={c.veredito} className={c.qtd > 0 ? "com-voto" : ""}>
                {VEREDITOS[c.veredito]}: <strong>{c.qtd}</strong>
              </span>
            ))}
          </div>
          {r.meuVoto > 0 && (
            <div className="placar-meu">Seu voto nesta rodada: {VEREDITOS[r.meuVoto]}</div>
          )}
        </div>
      )}

      {/* Ações */}
      {podeAbrir && (
        <button className="botao" disabled={ocupado} onClick={() => rodar("abrirVerificacao", [r.id])}>
          {ocupado ? "Aguardando a rede..." : "Abrir verificação"}
        </button>
      )}

      {podeVotar && (
        <div className="acao-bloco">
          <input
            type="text"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Justificativa (opcional)"
          />
          <div className="botoes-voto">
            {r.contagem.map((c) => (
              <button
                key={c.veredito}
                className="botao claro"
                disabled={ocupado}
                onClick={() => rodar("votar", [r.id, c.veredito, justificativa])}
              >
                Votar: {VEREDITOS[c.veredito]}
              </button>
            ))}
          </div>
        </div>
      )}

      {r.estado === 1 && janelaAberta && conta && !r.euPossoVotar && r.meuVoto === 0 && (
        <p className="nota-estado">
          Esta conta não pode votar aqui: só revisores votam, e o autor não vota no próprio registro.
        </p>
      )}

      {podeFinalizar && (
        <button className="botao" disabled={ocupado} onClick={() => rodar("finalizar", [r.id])}>
          {ocupado ? "Aguardando a rede..." : "Finalizar votação"}
        </button>
      )}

      {podeContestar && !mostrarContestar && (
        <button className="link-discreto" onClick={() => setMostrarContestar(true)}>
          Discorda deste veredito?
        </button>
      )}

      {podeContestar && mostrarContestar && (
        <div className="acao-bloco">
          <p className="nota-estado">
            Este veredito já vale. Só conteste se você <strong>discorda</strong> dele e quer reabrir a
            votação. Se concorda, não precisa fazer nada.
          </p>
          <input
            type="text"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da contestação"
          />
          <div className="botoes-voto">
            <button
              className="botao claro"
              disabled={ocupado}
              onClick={() => rodar("contestar", [r.id, motivo])}
            >
              Contestar o veredito
            </button>
            <button className="link-discreto" onClick={() => setMostrarContestar(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {erro && <div className="aviso erro">{erro}</div>}
      {hash && (
        <div className="aviso ok">
          Confirmado!{" "}
          <a href={`${EXPLORADOR}/tx/${hash}`} target="_blank" rel="noreferrer">
            Ver a transação
          </a>
        </div>
      )}
    </article>
  );
}
