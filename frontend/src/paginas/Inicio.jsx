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
  { h: 118, c: "--v", t: "Esgoto 2026" },
  { h: 150, c: "--c", t: "Tarifa 2025" },
  { h: 132, c: "--x", t: "Esgoto 2024" },
  { h: 160, c: "--f", t: "Fila SUS" },
  { h: 124, c: "--v", t: "Escolas" },
  { h: 146, c: "--s", t: "Inflação" },
  { h: 136, c: "--w", t: "Em votação" },
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
            style={{ "--h": l.h + "px", "--c": `var(${l.c})`, "--i": i }}
          >
            <b>{l.t}</b>
            {l.c === "--x" && <i className="lp-selo" />}
          </span>
        ))}
      </div>
      <div className="lp-tabua" />
      <div className="lp-etiqueta">
        <span className="pt" /> Verificado · 3 de 5 revisores
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
        <span>5 revisores votam</span>
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
    texto: "Um revisor registra uma afirmação (com o período a que ela se refere) ou uma promessa (com prazo e critérios claros) e anexa as fontes.",
    icone: "✍️",
  },
  {
    n: "2",
    titulo: "Votar",
    texto: "Os revisores analisam as provas e votam. Cada voto fica gravado, com justificativa. O autor não vota no próprio registro.",
    icone: "🗳️",
  },
  {
    n: "3",
    titulo: "Veredito",
    texto: "O veredito só vale com mais de 50% dos revisores. Sem maioria, nada é gravado: melhor admitir que não há consenso do que fingir certeza.",
    icone: "⚖️",
  },
  {
    n: "4",
    titulo: "Corrigir",
    texto: "Houve erro? Há uma janela para contestar. Mudou o fato? Um novo registro substitui o antigo, e o antigo continua visível como histórico.",
    icone: "🔁",
  },
];

const FAQ = [
  ["Quem decide o que é verdade?", "Um grupo de revisores cadastrados, olhando provas públicas. Nenhum revisor decide sozinho: o veredito precisa de mais de 50% deles, todos os votos ficam abertos e qualquer resultado pode ser contestado dentro de uma janela de tempo."],
  ["O que acontece se o fato mudar depois?", "O veredito é uma foto datada, e não uma verdade eterna. Se o fato mudar, alguém registra uma correção. Se ela for aprovada, o registro antigo ganha a marca “Superado” e continua visível, com o histórico completo."],
  ["Preciso de carteira para usar o site?", "Para consultar, não. Qualquer pessoa pesquisa, navega pela estante, pelo mapa e pela linha do tempo. A carteira (MetaMask) só é necessária para registrar e votar."],
  ["Isso é de graça?", "Consultar é livre. Registrar e votar gravam dados na blockchain e usam uma pequena taxa de rede. Neste protótipo, a rede é de testes e a taxa é paga com ETH de teste, que não vale dinheiro."],
  ["Posso confiar no que está aqui?", "Este é um protótipo acadêmico com exemplos fictícios. O que a blockchain garante é que o registro não foi alterado depois, e não que o conteúdo seja verdadeiro: quem confere as provas são os revisores."],
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
            Notícias, dados e promessas se perdem, são editados ou somem. No OathChain, cada verificação vira um
            registro com data, autor e histórico que ninguém apaga nem altera.
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
            O veredito vence quando passa de 50% dos revisores da rodada. Com 5 revisores, são necessários 3 votos
            iguais.
          </p>
          <BarraDemo />
        </Revelar>
      </section>

      {/* ---------- Números ao vivo ---------- */}
      <section className="lp-sec-bloco">
        <Revelar><p className="lp-etq">Ao vivo, direto do contrato</p></Revelar>
        <div className="lp-numeros">
          <Revelar className="lp-numero"><strong><Contador valor={total} /></strong><span>registros guardados</span></Revelar>
          <Revelar atraso={100} className="lp-numero"><strong><Contador valor={revisores} /></strong><span>revisores ativos</span></Revelar>
          <Revelar atraso={200} className="lp-numero"><strong><Contador valor={defs} /></strong><span>vereditos definitivos</span></Revelar>
        </div>
        <Revelar><p className="mut lp-centro">
          {d.resumo ? "Estes números são lidos da blockchain neste momento." : "Os números aparecem quando o site consegue ler o contrato."}
        </p></Revelar>
      </section>

      {/* ---------- O que dá para fazer ---------- */}
      <section className="lp-sec-bloco lp-escuro">
        <Revelar><p className="lp-etq">O que você encontra aqui</p></Revelar>
        <Revelar atraso={60}><h2>Procure do jeito que fizer mais sentido.</h2></Revelar>
        <div className="lp-grade">
          {[
            ["🔎", "Verificar", "Cole uma afirmação e veja se ela já foi verificada.", "verificar"],
            ["📚", "Estante", "Cada registro é um livro, e a cor mostra a situação.", "estante"],
            ["🗺️", "Mapa", "Registros por estado e cidade, no mapa do Brasil.", "mapa"],
            ["🕰️", "Linha do tempo", "Veja como a verdade mudou em cada assunto.", "linha"],
            ["🗂️", "Assuntos", "Salas por tema: educação, economia, saneamento e mais.", "assuntos"],
            ["🧑‍⚖️", "Revisores", "Quem vota, quantos votos deu e como decide.", "revisores"],
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
      <section className="lp-sec-bloco">
        <Revelar><p className="lp-etq">Por que blockchain?</p></Revelar>
        <Revelar atraso={60}><h2>Porque o histórico não pode ter dono.</h2></Revelar>
        <div className="lp-trio">
          {[
            ["🔒", "Imutável e datado", "Depois de gravado, o registro não pode ser editado nem apagado por ninguém, nem pelos criadores do site."],
            ["👁️", "Regras abertas", "Maioria, prazos e limite de contestações estão no código, visíveis a todos e iguais para qualquer pessoa ou tema."],
            ["🧾", "Tudo auditável", "Cada voto, cada contestação e cada correção ficam registrados e podem ser conferidos por qualquer pessoa."],
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
            depois. Quem confere as provas são os revisores, e é por isso que o veredito exige maioria e pode ser contestado.
          </p>
        </Revelar>
      </section>

      {/* ---------- Para quem ---------- */}
      <section className="lp-sec-bloco lp-escuro">
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
      <section className="lp-sec-bloco">
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
