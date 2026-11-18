import { useEffect, useRef, useState } from "react";
import { T, ASSUNTOS } from "../dados";
import { Ir } from "../componentes";
import { definitivo } from "../oathchain";
import "./inicio.css";

// ---------------------------------------------------------------
// Animações simples (sem bibliotecas): aparecer ao rolar e contar números
// ---------------------------------------------------------------

// Marca o elemento com a classe "on" quando ele entra na tela
function useRevelar() {
  const ref = useRef(null);
  const [visivel, setVisivel] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setVisivel(true);
      return undefined;
    }
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisivel(true);
          obs.disconnect();
        }
      },
      { threshold: 0.18 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return [ref, visivel];
}

function Revelar({ children, atraso = 0, className = "", como: Tag = "div" }) {
  const [ref, ok] = useRevelar();
  return (
    <Tag ref={ref} className={"rv " + (ok ? "on " : "") + className} style={{ transitionDelay: atraso + "ms" }}>
      {children}
    </Tag>
  );
}

// Número que sobe de 0 até o valor quando aparece
function Contador({ valor, sufixo = "" }) {
  const [ref, ok] = useRevelar();
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!ok) return undefined;
    const reduz = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    if (reduz || valor === 0) {
      setN(valor);
      return undefined;
    }
    let quadro;
    const ini = performance.now();
    const dur = 1300;
    const passo = (t) => {
      const p = Math.min(1, (t - ini) / dur);
      setN(Math.round(valor * (1 - Math.pow(1 - p, 3))));
      if (p < 1) quadro = requestAnimationFrame(passo);
    };
    quadro = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(quadro);
  }, [ok, valor]);
  return (
    <span ref={ref}>
      {n}
      {sufixo}
    </span>
  );
}

// ---------------------------------------------------------------
// Peças visuais
// ---------------------------------------------------------------

// Estante animada do topo: livros que "caem" nas prateleiras e um recebe o selo
const LIVROS = [
  { h: 118, c: "#2da36f", t: "Esgoto 2026" },
  { h: 150, c: "#e0a92a", t: "Tarifa 2025" },
  { h: 132, c: "#6d56a3", t: "Esgoto 2024" },
  { h: 160, c: "#e5484d", t: "Fila SUS" },
  { h: 124, c: "#2da36f", t: "Escolas" },
  { h: 146, c: "#7a7c84", t: "Inflação" },
  { h: 136, c: "#4c8dd6", t: "Em votação" },
  { h: 128, c: "#14b8a6", t: "Provisório IA" },
];

function EstanteAnimada() {
  const [rodada, setRodada] = useState(0);
  return (
    <div className="lp-estante" onMouseEnter={() => setRodada((r) => r + 1)} aria-hidden="true">
      <div className="lp-livros" key={rodada}>
        {LIVROS.map((l, i) => (
          <span
            key={i}
            className="lp-livro"
            style={{ "--h": l.h + "px", "--c": l.c, "--i": i }}
          >
            <b>{l.t}</b>
            {l.c === "#6d56a3" && <i className="lp-selo" />}
          </span>
        ))}
      </div>
      <div className="lp-tabua" />
      <div className="lp-etiqueta">
        <span className="pt" /> IA 82% · júri sorteado: 3 de 5
      </div>
    </div>
  );
}

// Demonstração da regra da maioria: a barra enche até passar de 50%
function BarraDemo() {
  const [ref, ok] = useRevelar();
  return (
    <div ref={ref} className={"lp-demo" + (ok ? " on" : "")}>
      <div className="lp-demo-cab">
        <span>5 jurados sorteados votam</span>
        <b>3 votos “Verdadeira”</b>
      </div>
      <div className="lp-demo-barra">
        <i className="a" />
        <i className="meio" />
      </div>
      <div className="lp-demo-pe">
        <span>0%</span>
        <span>mais de 50% = o veredito vale</span>
        <span>100%</span>
      </div>
    </div>
  );
}

const ETAPAS = [
  {
    n: "1",
    titulo: "Registrar",
    texto: "Alguém registra uma afirmação (com o período a que ela se refere) ou uma promessa (com prazo e critérios claros) e anexa as fontes.",
    icone: "✍️",
  },
  {
    n: "2",
    titulo: "A IA verifica",
    texto: "Quatro agentes de IA pesquisam as fontes e dão um veredito provisório, com a confiança e um relatório que qualquer pessoa pode conferir.",
    icone: "🤖",
  },
  {
    n: "3",
    titulo: "Humanos recorrem",
    texto: "Se a IA tiver dúvida, ou se alguém discordar dentro da janela de recurso, um júri sorteado decide por voto secreto, com fonte e justificativa.",
    icone: "🎲",
  },
  {
    n: "4",
    titulo: "Corrigir",
    texto: "Houve erro? Há uma janela para contestar. Mudou o fato? Um novo registro substitui o antigo, e o antigo continua visível como histórico.",
    icone: "🔁",
  },
];

const AGENTES = [
  ["🔎", "Pesquisador", "Cria as buscas e reúne evidências em fontes abertas: agências de checagem, Wikipédia e páginas da web."],
  ["📏", "Avaliador de fontes", "Dá uma nota de credibilidade a cada fonte. Dado oficial e checagem profissional pesam mais que blog."],
  ["🧠", "Analista especialista", "Analisa a afirmação conforme o assunto (economia, saúde, meio ambiente...) usando apenas as fontes encontradas."],
  ["⚖️", "Contraditor", "Tenta derrubar a conclusão do analista. Se ela resistir, a confiança sobe; se não, o veredito vira inconclusivo."],
];

const JURI = [
  ["🎲", "Sorteio sem escolha", "Os jurados saem de um sorteio com o hash de um bloco futuro. Nem o autor nem os criadores do site escolhem quem julga."],
  ["🔐", "Voto selado", "Na primeira metade do prazo cada jurado guarda só o código do seu voto. Ninguém vê o voto dos outros, então não dá para copiar a maioria."],
  ["📎", "Voto revelado e fundamentado", "Na segunda metade o voto é revelado, com justificativa e link da fonte. Quem foi sorteado e não participa leva uma falta."],
];

const REVISOR = [
  ["📝", "1. Candidatura", "Qualquer pessoa se candida com um depósito de garantia. Não existe porteiro: ninguém precisa pedir permissão."],
  ["🎓", "2. Período de prova", "Como aprendiz, você observa júris reais e vota, sem que o seu voto conte no resultado."],
  ["🚀", "3. Promoção automática", "Com votos fundamentados e sem faltas, o contrato promove você a revisor sozinho. O crescimento é gradual, para barrar contas falsas."],
  ["🧭", "4. Sem “maria vai com as outras”", "Discordar da maioria não custa nada. Só a falta de participação é punida: o que vale é pesquisar e chegar ao seu veredito."],
];

const FAQ = [
  ["Quem decide o que é verdade?", "Primeiro, quatro agentes de IA analisam as fontes e dão um veredito provisório. Se houver dúvida ou recurso, decide um júri de revisores sorteado, por voto secreto e com mais de 50% dos jurados. Ninguém decide sozinho, e todos os votos e relatórios ficam abertos."],
  ["A IA pode errar?", "Pode, e por isso ela nunca fecha um veredito sozinha: o resultado é provisório, o relatório é público (com hash na blockchain) e há uma janela para recorrer a humanos. A IA também só verifica fatos checáveis; opiniões tendem a ficar como inconclusivas."],
  ["Por que o voto do júri é secreto?", "Para ninguém copiar a maioria. Primeiro cada jurado sela o voto; só depois todos revelam, com justificativa e link da fonte. Assim cada um é incentivado a pesquisar e chegar ao próprio veredito."],
  ["Como me torno revisor?", "Pela página “Seja revisor”: você se candida com um depósito, vira aprendiz, observa júris reais e é promovido automaticamente quando participa com fundamentação. Discordar da maioria nunca é punido; só faltar quando for sorteado."],
  ["O que acontece se o fato mudar depois?", "O veredito é uma foto datada, e não uma verdade eterna. Se o fato mudar, alguém registra uma correção. Se ela for aprovada, o registro antigo ganha a marca “Superado” e continua visível, com o histórico completo."],
  ["Preciso de carteira para usar o site?", "Para consultar, não. Qualquer pessoa pesquisa, navega pela estante, pelo mapa e pela linha do tempo. A carteira (MetaMask) só é necessária para registrar, votar e se candidatar."],
  ["Isso é de graça?", "Consultar é livre. Registrar e votar gravam dados na blockchain e usam uma pequena taxa de rede. Neste protótipo, a rede é de testes e a taxa (e o depósito) são pagos com ETH de teste, que não vale dinheiro."],
  ["Posso confiar no que está aqui?", "Este é um protótipo acadêmico com exemplos fictícios. O que a blockchain garante é que o registro não foi alterado depois, e não que o conteúdo seja verdadeiro: quem confere as provas são a IA e os jurados."],
];

const PUBLICO = [
  ["🧑‍🤝‍🧑", "Cidadão comum", "Descubra se aquela notícia ou dado que chegou no grupo da família já foi verificado."],
  ["🎓", "Estudantes", "Encontre fontes e veja como uma conclusão mudou ao longo do tempo."],
  ["📰", "Jornalistas e checadores", "Cite um registro com data, autor e histórico que ninguém consegue editar."],
  ["🗳️", "Eleitores", "Compare o que foi prometido com o que foi cumprido, com prazo e critérios definidos desde o início."],
];

// ---------------------------------------------------------------
// Página
// ---------------------------------------------------------------

export default function Inicio({ d }) {
  const total = d.registros.length;
  const defs = d.registros.filter((r) => definitivo(r, d.agora)).length;
  const revisores = d.resumo?.revisoresAtivos ?? 0;
  const pelaIA = d.registros.filter((r) => r.ia).length;
  const [aberta, setAberta] = useState(0);

  const rolarPara = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="lp">
      {/* ---------- Topo ---------- */}
      <section className="lp-hero">
        <div className="lp-orbe lp-orbe-a" aria-hidden="true" />
        <div className="lp-orbe lp-orbe-b" aria-hidden="true" />
        <div className="lp-hero-txt">
          <img className="lp-logo" src="/simbolo-fundo-escuro.png" alt="" width="84" />
          <p className="lp-etq">Livro-razão público de afirmações e promessas</p>
          <h1>
            Toda afirmação verificada <span className="lp-dourado">fica guardada para sempre.</span>
          </h1>
          <p className="lp-sub">
            Notícias, dados e promessas se perdem, são editados ou somem. No OathChain, quatro agentes de IA verificam
            primeiro e um júri humano sorteado decide os recursos. Cada verificação vira um registro com data, autor,
            relatório e histórico que ninguém apaga nem altera.
          </p>
          <div className="lp-cta">
            <Ir className="main-btn" para="estante">Explorar a estante</Ir>
            <button className="lp-sec" onClick={() => rolarPara("como-funciona")}>Como funciona ↓</button>
          </div>
          <p className="lp-nota">Consultar é livre e não precisa de carteira.</p>
        </div>
        <EstanteAnimada />
      </section>

      {/* ---------- Faixa de assuntos ---------- */}
      <div className="lp-faixa" aria-hidden="true">
        <div className="lp-faixa-trilho">
          {[...ASSUNTOS, ...ASSUNTOS, ...ASSUNTOS].map((a, i) => (
            <span key={i}>
              <i style={{ background: T[a].a }} /> {T[a].e} {a}
            </span>
          ))}
        </div>
      </div>

      {/* ---------- O problema ---------- */}
      <section className="lp-sec-bloco">
        <Revelar><p className="lp-etq">O problema</p></Revelar>
        <Revelar atraso={60}><h2>A verdade tem memória curta.</h2></Revelar>
        <div className="lp-trio">
          {[
            ["🕳️", "Promessas se perdem", "Anos depois, ninguém lembra exatamente o que foi dito. Sem registro com data, cobrar fica quase impossível."],
            ["✏️", "Verificações são editadas", "Um veredito pode ser alterado ou removido sem aviso, e a checagem original desaparece sem deixar rastro."],
            ["⏳", "A verdade muda", "Um dado correto hoje pode estar errado amanhã. Marcar algo como verdadeiro para sempre também é um erro."],
          ].map(([ic, t, tx], i) => (
            <Revelar key={t} atraso={i * 110} className="lp-cartao">
              <span className="lp-ic">{ic}</span>
              <h3>{t}</h3>
              <p>{tx}</p>
            </Revelar>
          ))}
        </div>
      </section>

      {/* ---------- Como funciona ---------- */}
      <section className="lp-sec-bloco lp-escuro" id="como-funciona">
        <Revelar><p className="lp-etq">Como funciona</p></Revelar>
        <Revelar atraso={60}><h2>Quatro passos, todos à vista.</h2></Revelar>
        <ol className="lp-etapas">
          {ETAPAS.map((e, i) => (
            <Revelar como="li" key={e.n} atraso={i * 140} className="lp-etapa">
              <span className="lp-num">{e.n}</span>
              <span className="lp-ic">{e.icone}</span>
              <h3>{e.titulo}</h3>
              <p>{e.texto}</p>
            </Revelar>
          ))}
        </ol>
        <Revelar className="lp-demo-bloco">
          <h3>A regra da maioria, na prática</h3>
          <p className="mut">
            Quando a IA tem dúvida (ou alguém recorre), decide um júri sorteado: o veredito vence com mais de 50% dos
            jurados. Com 5 jurados, são necessários 3 votos iguais.
          </p>
          <BarraDemo />
        </Revelar>
      </section>

      {/* ---------- Os 4 agentes de IA ---------- */}
      <section className="lp-sec-bloco">
        <Revelar><p className="lp-etq">Verificação automática</p></Revelar>
        <Revelar atraso={60}><h2>Quatro agentes de IA, um debate.</h2></Revelar>
        <Revelar><p className="mut lp-intro">
          A IA responde em minutos, mas nunca decide sozinha: o veredito dela é <b>provisório</b> e fica aberto a recurso
          humano por alguns dias. Tudo o que ela fez fica num relatório público.
        </p></Revelar>
        <div className="lp-publico">
          {AGENTES.map(([ic, t, tx], i) => (
            <Revelar key={t} atraso={i * 90} className="lp-cartao">
              <span className="lp-ic">{ic}</span>
              <h3>{t}</h3>
              <p>{tx}</p>
            </Revelar>
          ))}
        </div>
        <div className="lp-pares">
          <Revelar className="lp-par">
            <h3>📋 O relator não é uma IA</h3>
            <p>
              A decisão final sai de regras fixas e abertas: vence o veredito com 2 de 3 votos dos agentes, a confiança é a
              média de quem concordou e há tetos (poucas fontes, fontes fracas ou contraditor discordando reduzem a nota).
              Com confiança abaixo de 70%, a decisão passa direto para o júri humano.
            </p>
          </Revelar>
          <Revelar atraso={100} className="lp-par">
            <h3>🧾 Relatório que não dá para adulterar</h3>
            <p>
              O relatório completo (buscas, fontes, notas e o voto de cada agente) é um arquivo cujo <b>hash fica gravado
              na blockchain</b>. O site baixa o arquivo e confere sozinho: se uma vírgula mudar, o hash não bate.
            </p>
          </Revelar>
        </div>
        <Revelar>
          <p className="lp-aviso">
            <b>A IA pode errar.</b> Por isso o veredito é provisório, o relatório é público e qualquer revisor pode
            recorrer. Ela verifica fatos checáveis; opiniões e previsões tendem a sair como “inconclusivas”.
          </p>
        </Revelar>
      </section>

      {/* ---------- Júri sorteado ---------- */}
      <section className="lp-sec-bloco lp-escuro">
        <Revelar><p className="lp-etq">Recurso humano</p></Revelar>
        <Revelar atraso={60}><h2>Júri sorteado e voto secreto.</h2></Revelar>
        <div className="lp-trio">
          {JURI.map(([ic, t, tx], i) => (
            <Revelar key={t} atraso={i * 110} className="lp-cartao">
              <span className="lp-ic">{ic}</span>
              <h3>{t}</h3>
              <p>{tx}</p>
            </Revelar>
          ))}
        </div>
      </section>

      {/* ---------- Seja revisor ---------- */}
      <section className="lp-sec-bloco">
        <Revelar><p className="lp-etq">Revisores sem porteiro</p></Revelar>
        <Revelar atraso={60}><h2>Quer ajudar a verificar? Candidate-se.</h2></Revelar>
        <div className="lp-publico">
          {REVISOR.map(([ic, t, tx], i) => (
            <Revelar key={t} atraso={i * 90} className="lp-cartao">
              <span className="lp-ic">{ic}</span>
              <h3>{t}</h3>
              <p>{tx}</p>
            </Revelar>
          ))}
        </div>
        <Revelar>
          <div className="lp-cta" style={{ marginTop: 26, animation: "none" }}>
            <Ir className="main-btn" para="revisor">Quero ser revisor</Ir>
          </div>
        </Revelar>
      </section>

      {/* ---------- Números ao vivo ---------- */}
      <section className="lp-sec-bloco lp-escuro">
        <Revelar><p className="lp-etq">Ao vivo, direto do contrato</p></Revelar>
        <div className="lp-numeros">
          <Revelar className="lp-numero"><strong><Contador valor={total} /></strong><span>registros guardados</span></Revelar>
          <Revelar atraso={100} className="lp-numero"><strong><Contador valor={revisores} /></strong><span>revisores ativos</span></Revelar>
          <Revelar atraso={200} className="lp-numero"><strong><Contador valor={pelaIA} /></strong><span>verificadas pela IA</span></Revelar>
          <Revelar atraso={300} className="lp-numero"><strong><Contador valor={defs} /></strong><span>vereditos definitivos</span></Revelar>
        </div>
        <Revelar><p className="mut lp-centro">
          {d.resumo ? "Estes números são lidos da blockchain neste momento." : "Os números aparecem quando o site consegue ler o contrato."}
        </p></Revelar>
      </section>

      {/* ---------- O que dá para fazer ---------- */}
      <section className="lp-sec-bloco">
        <Revelar><p className="lp-etq">O que você encontra aqui</p></Revelar>
        <Revelar atraso={60}><h2>Procure do jeito que fizer mais sentido.</h2></Revelar>
        <div className="lp-grade">
          {[
            ["🔎", "Verificar", "Cole uma afirmação e veja se ela já foi verificada.", "verificar"],
            ["📚", "Estante", "Cada registro é um livro, e a cor mostra a situação.", "estante"],
            ["🗺️", "Mapa", "Registros por estado e cidade, no mapa do Brasil.", "mapa"],
            ["🕰️", "Linha do tempo", "Veja como a verdade mudou em cada assunto.", "linha"],
            ["🗂️", "Assuntos", "Salas por tema: educação, economia, saneamento e mais.", "assuntos"],
            ["🎓", "Seja revisor", "Candidate-se, passe pelo período de prova e seja promovido sozinho.", "revisor"],
          ].map(([ic, t, tx, rota], i) => (
            <Revelar key={rota} atraso={(i % 3) * 90}>
              <Ir className="lp-atalho" para={rota}>
                <span className="lp-ic">{ic}</span>
                <b>{t}</b>
                <small>{tx}</small>
                <span className="lp-seta">→</span>
              </Ir>
            </Revelar>
          ))}
        </div>
      </section>

      {/* ---------- Por que blockchain ---------- */}
      <section className="lp-sec-bloco lp-escuro">
        <Revelar><p className="lp-etq">Por que blockchain?</p></Revelar>
        <Revelar atraso={60}><h2>Porque o histórico não pode ter dono.</h2></Revelar>
        <div className="lp-trio">
          {[
            ["🔒", "Imutável e datado", "Depois de gravado, o registro não pode ser editado nem apagado por ninguém, nem pelos criadores do site."],
            ["👁️", "Regras abertas", "Sorteio do júri, maioria, prazos e limite de contestações estão no código, visíveis a todos e iguais para qualquer pessoa ou tema."],
            ["🧾", "Tudo auditável", "Cada voto, cada recurso, cada correção e o hash do relatório da IA ficam registrados e podem ser conferidos por qualquer pessoa."],
          ].map(([ic, t, tx], i) => (
            <Revelar key={t} atraso={i * 110} className="lp-cartao">
              <span className="lp-ic">{ic}</span>
              <h3>{t}</h3>
              <p>{tx}</p>
            </Revelar>
          ))}
        </div>
        <Revelar>
          <p className="lp-aviso">
            <b>O que a blockchain não faz:</b> ela não garante que o dado seja verdadeiro, só que ele não foi alterado
            depois. Quem confere as provas são a IA e os jurados, e é por isso que o veredito da IA é provisório, o júri exige maioria e tudo pode ser contestado.
          </p>
        </Revelar>
      </section>

      {/* ---------- Para quem ---------- */}
      <section className="lp-sec-bloco">
        <Revelar><p className="lp-etq">Para quem é</p></Revelar>
        <Revelar atraso={60}><h2>Para quem quer saber o que é verdade.</h2></Revelar>
        <div className="lp-publico">
          {PUBLICO.map(([ic, t, tx], i) => (
            <Revelar key={t} atraso={i * 90} className="lp-cartao">
              <span className="lp-ic">{ic}</span>
              <h3>{t}</h3>
              <p>{tx}</p>
            </Revelar>
          ))}
        </div>
      </section>

      {/* ---------- Perguntas ---------- */}
      <section className="lp-sec-bloco lp-escuro">
        <Revelar><p className="lp-etq">Perguntas frequentes</p></Revelar>
        <Revelar atraso={60}><h2>Antes de começar.</h2></Revelar>
        <div className="lp-faq">
          {FAQ.map(([q, a], i) => (
            <Revelar key={q} atraso={i * 70}>
              <details open={aberta === i}>
                <summary onClick={(e) => { e.preventDefault(); setAberta(aberta === i ? -1 : i); }}>{q}</summary>
                <p>{a}</p>
              </details>
            </Revelar>
          ))}
        </div>
      </section>

      {/* ---------- Chamada final ---------- */}
      <section className="lp-final">
        <Revelar>
          <img src="/simbolo-fundo-escuro.png" alt="" width="64" />
          <h2>Promessas feitas em público merecem memória pública.</h2>
          <div className="lp-cta lp-cta-centro">
            <Ir className="main-btn" para="estante">Entrar na estante</Ir>
            <Ir className="lp-sec" para="verificar">Verificar uma afirmação</Ir>
          </div>
          <p className="lp-nota">
            Protótipo acadêmico em rede de testes. Os exemplos são fictícios e nada aqui vale como decisão oficial.
          </p>
        </Revelar>
      </section>
    </div>
  );
}
