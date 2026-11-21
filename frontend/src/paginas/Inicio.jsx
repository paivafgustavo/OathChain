// Página inicial. A abertura é comandada pela ROLAGEM (CSS scroll-driven animations):
// cada "trilho" é uma seção alta; dentro dela um palco fica preso na tela e a rolagem
// move as peças. Sem suporte do navegador ou com "reduzir movimento", tudo aparece no estado final.
import { ST } from "../dados";
import { irPara, curto } from "../componentes";
import { VEREDITOS, statusDe, rotuloStatus, formatarDuracao, abreviar } from "../oathchain";
import Simbolo from "../Simbolo";
import "./inicio.css";

// Uma lombada por cor de assunto (Meio Ambiente, Economia, Educação, Saúde, Segurança, Saneamento...)
const LOMBADAS = ["#2E8B5E", "#B9823A", "#5B6FB8", "#B8505A", "#3E5A9A", "#2E7FA6", "#3FA86F", "#C99A4B"];

const PASSOS = [
  ["01", "Um revisor registra.", "Com o período a que a afirmação se refere."],
  ["02", "Quatro IAs debatem.", "Uma pesquisa, uma pesa as fontes, uma decide, uma tenta derrubar."],
  ["03", "Humanos podem recorrer.", "Um júri sorteado vota com justificativa e fonte."],
  ["04", "Fica para sempre.", "Correções substituem, nunca apagam."],
];

export default function Inicio({ d }) {
  const { registros, resumo, agora } = d;
  // Para a "vista explodida": o registro mais recente que já tem verificação da IA
  const exemplo = registros.find((r) => r.ia) || registros[0];
  const juri = resumo?.tamanhoJuri || 5;
  const recentes = registros.slice(0, 8);

  return (
    <div className="ini">
      {/* 1) Os elos da logo se encontram e se entrelaçam */}
      <section className="trilho tr-a">
        <div className="palco palco-col">
          <div className="elos">
            <div className="elos-brilho" />
            <Simbolo parte="creme" className="elo elo-creme voo" />
            <Simbolo parte="ouro" className="elo elo-ouro voo" />
            <Simbolo parte="entrelacado" className="elo elo-final" rotulo="Símbolo do OathChain: um anel creme entrelaçado a um C dourado, com um ponto entre as pontas do C" />
            <Simbolo parte="ponto" className="elo elo-ponto" />
          </div>
          <div className="falas">
            <h1 className="fala f1">Uma promessa.</h1>
            <h1 className="fala f2">Um compromisso público.</h1>
            <h1 className="fala f3">Uma corrente que ninguém quebra.</h1>
          </div>
          <p className="dica" aria-hidden="true">Role para ver ↓</p>
        </div>
      </section>

      {/* 2) Vista explodida de um registro */}
      <section className="trilho tr-b">
        <div className="palco palco-lado">
          <div className="explosao" aria-hidden="true">
            <div className="ex-cena">
              <div className="ex-c ex-c1">
                <p className="ex-tit">VOTOS DO JÚRI</p>
                <p className="ex-votos">{Array.from({ length: juri }, (_, i) => <span key={i} className={i < (exemplo?.totalVotos || 3) ? "cheio" : ""} />)}</p>
              </div>
              <div className="ex-c ex-c2">
                <p className="ex-tit">HASH NA BLOCKCHAIN</p>
                <p className="ex-hash">{exemplo?.ia?.hashRelatorio ? exemplo.ia.hashRelatorio.slice(0, 38) + "…" : "0x7f3a…c41e"}</p>
              </div>
              <div className="ex-c ex-c3">
                <p className="ex-tit">RELATÓRIO DA IA · IPFS</p>
                <p className="ex-txt">{exemplo?.ia ? `4 agentes · ${VEREDITOS[exemplo.ia.veredito]} ${exemplo.ia.confianca}%` : "4 agentes · fontes · votos dos agentes"}</p>
              </div>
              <div className="ex-c ex-c4">
                <p className="ex-tit escuro">A AFIRMAÇÃO</p>
                <p className="ex-afirma">{exemplo ? curto(exemplo.texto, 90) : "Toda afirmação fica gravada com autor e data."}</p>
              </div>
            </div>
          </div>
          <div className="ex-legenda">
            <h2>Por dentro de um registro.</h2>
            <p className="rot"><b>A afirmação</b>, com autor e data, gravada no contrato.</p>
            <p className="rot"><b>O relatório da IA</b>, guardado no IPFS, com cada fonte e cada voto dos agentes.</p>
            <p className="rot"><b>O hash</b> desse relatório: mudou uma vírgula, o hash denuncia.</p>
            <p className="rot"><b>Os votos do júri</b>, cada um com justificativa e fonte.</p>
          </div>
        </div>
      </section>

      {/* 3) Os quatro passos, com um anel de progresso */}
      <section className="trilho tr-c">
        <div className="palco palco-lado">
          <svg className="anel-passos" viewBox="0 0 300 300" aria-hidden="true">
            <circle cx="150" cy="150" r="140" fill="none" stroke="#13213F" strokeWidth="14" />
            <circle className="anel-arco" cx="150" cy="150" r="140" fill="none" stroke="#DAA14E" strokeWidth="14" strokeLinecap="round" strokeDasharray="880" strokeDashoffset="0" transform="rotate(-90 150 150)" />
            <image href="/simbolo-fundo-escuro.png" x="70" y="96" width="160" height="108" />
          </svg>
          <ol className="passos-rol">
            {PASSOS.map(([n, t, txt], i) => (
              <li key={n} className={"pr pr" + (i + 1)}>
                <p className="pr-n">{n}</p>
                <h3>{t}</h3>
                <p className="mut">{txt}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 4) Passe pelo anel e entre na estante */}
      <section className="trilho tr-d">
        <div className="palco">
          <div className="d-estante">
            <h2>Entre na estante.</h2>
            <div className="d-livros" aria-hidden="true">
              {LOMBADAS.map((cor, i) => (
                <span key={i} style={{ height: 176 + ((i * 29) % 56), width: 40 + ((i * 7) % 14), background: cor }} />
              ))}
            </div>
            <div className="d-cta">
              <button className="main-btn" onClick={() => irPara("explorar/estante")}>Explorar registros</button>
              <button className="wallet" onClick={() => irPara("participar")}>Quero participar</button>
            </div>
          </div>
          <div className="d-cobre" aria-hidden="true"><div className="d-anel" /></div>
          <p className="d-texto" aria-hidden="true">Agora, veja os registros.</p>
        </div>
      </section>

      {/* Números reais, lidos do contrato */}
      <section className="ini-bloco">
        <div className="numeros">
          <div className="card inclina"><p className="num">4</p><p className="mut">agentes de IA debatem cada afirmação</p></div>
          <div className="card inclina"><p className="num">{juri}</p><p className="mut">jurados sorteados quando alguém recorre</p></div>
          <div className="card inclina"><p className="num">{resumo ? formatarDuracao(resumo.janelaRevisaoIA) : "3 dias"}</p><p className="mut">para recorrer de qualquer veredito da IA</p></div>
          <div className="card inclina destaque"><p className="num">{resumo ? resumo.totalRegistros : "…"}</p><p className="mut">registros gravados, {resumo ? resumo.revisoresAtivos : "…"} revisores ativos</p></div>
        </div>
      </section>

      {recentes.length > 0 && (
        <section className="ini-faixa">
          <div className="ini-faixa-cab">
            <h2>Vereditos recentes</h2>
            <button className="lk-btn" onClick={() => irPara("explorar/lista")}>Ver todos os registros</button>
          </div>
          <div className="faixa-mascara">
            <div className={"faixa" + (recentes.length < 3 ? " parada" : "")}>
              {(recentes.length < 3 ? recentes : recentes.concat(recentes)).map((r, i) => {
                const k = statusDe(r, agora);
                return (
                  <button key={i} className="faixa-c inclina" onClick={() => irPara("registro/" + r.id)} tabIndex={i >= recentes.length ? -1 : 0} aria-hidden={i >= recentes.length || undefined}>
                    <span className="mut faixa-a">{r.assunto}</span>
                    <span className="faixa-t">{curto(r.texto, 110)}</span>
                    <span className="selo-st" style={{ "--cor": `var(${ST[k][1]})` }}>{rotuloStatus(r, agora)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="ini-bloco">
        <div className="ini-final card">
          <div>
            <h2>Quer ajudar a verificar?</h2>
            <p className="mut">Qualquer pessoa se candidata. Você começa como aprendiz, vota em júris de verdade e vira revisor pelos próprios votos, sem ninguém aprovar.</p>
          </div>
          <button className="main-btn" onClick={() => irPara("participar")}>Quero participar</button>
        </div>
        {d.conta && <p className="mut" style={{ textAlign: "center", fontSize: 14 }}>Conectado como {abreviar(d.conta)}.</p>}
      </section>
    </div>
  );
}
