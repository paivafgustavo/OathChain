// Ilustração animada de cada assunto (SVG). Usada nas caixas de assunto, no topo da sala
// e no fundo de cada prateleira. As animações são SMIL (<animate>), que o CSS não consegue
// pausar; por isso, com "reduzir movimento" ligado no sistema, elas nem são desenhadas.
import { createContext, useContext, useId } from "react";
import { useMovimentoReduzido } from "./movimento";

const svgBase = { viewBox: "0 0 400 200", preserveAspectRatio: "xMidYMax slice", "aria-hidden": true, className: "cena-svg" };

// Peças de animação: somem quando o movimento está reduzido (o valor chega por contexto)
const Parado = createContext(false);
function A(p) { return useContext(Parado) ? null : <animate repeatCount="indefinite" {...p} />; }
function AT(p) { return useContext(Parado) ? null : <animateTransform repeatCount="indefinite" {...p} />; }
function AM(p) { return useContext(Parado) ? null : <animateMotion repeatCount="indefinite" {...p} />; }

export default function Cena({ tema }) {
  const parado = useMovimentoReduzido();
  const id = useId().replace(/:/g, "");
  return (
    <Parado.Provider value={parado}>
      <Desenho tema={tema} parado={parado} id={id} />
    </Parado.Provider>
  );
}

function Desenho({ tema, parado, id }) {

  if (tema === "Meio Ambiente")
    return (
      <svg {...svgBase}>
        <defs>
          <linearGradient id={id + "ceu"} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#0E3B3A" /><stop offset="1" stopColor="#0B1730" /></linearGradient>
        </defs>
        <rect width="400" height="200" fill={`url(#${id}ceu)`} />
        <circle cx="330" cy="46" r="18" fill="#F3EAD3" opacity=".85"><A attributeName="opacity" values=".85;.6;.85" dur="6s" /></circle>
        <path d="M0 140 Q60 105 130 128 T260 118 T400 130 V200 H0Z" fill="#14514A" />
        <path d="M0 156 Q90 132 190 150 T400 146 V200 H0Z" fill="#1B6B57" />
        <path d="M-10 186 C70 166 120 196 200 178 S330 166 410 182" fill="none" stroke="#5FB7D4" strokeWidth="9" strokeLinecap="round" opacity=".85" />
        <path d="M-10 186 C70 166 120 196 200 178 S330 166 410 182" fill="none" stroke="#D8F1FA" strokeWidth="2" strokeDasharray="14 22" strokeLinecap="round">
          <A attributeName="stroke-dashoffset" from="0" to="-72" dur="2.4s" />
        </path>
        <g transform="translate(54 150)"><g>
          <AT attributeName="transform" type="rotate" values="-2 0 0;2 0 0;-2 0 0" dur="4s" />
          <rect x="-3" y="-6" width="6" height="22" fill="#5A4330" /><path d="M0 -58 L24 -6 H-24Z" fill="#2E8B5E" /><path d="M0 -76 L18 -34 H-18Z" fill="#3FA86F" />
        </g></g>
        <g transform="translate(96 146)"><g>
          <AT attributeName="transform" type="rotate" values="2 0 0;-2 0 0;2 0 0" dur="5s" />
          <rect x="-3" y="-4" width="6" height="20" fill="#5A4330" /><circle cx="0" cy="-22" r="22" fill="#3FA86F" /><circle cx="-12" cy="-12" r="13" fill="#2E8B5E" />
        </g></g>
        <g transform="translate(300 140)"><g>
          <AT attributeName="transform" type="rotate" values="-1.5 0 0;1.5 0 0;-1.5 0 0" dur="4.5s" />
          <rect x="-3" y="-6" width="6" height="24" fill="#5A4330" /><path d="M0 -64 L28 -4 H-28Z" fill="#2E8B5E" /><path d="M0 -84 L20 -38 H-20Z" fill="#3FA86F" />
        </g></g>
        <g transform="translate(352 152)"><rect x="-2" y="-4" width="5" height="16" fill="#5A4330" /><circle cx="0" cy="-16" r="16" fill="#3FA86F" /></g>
        <g transform="translate(210 166)">
          <ellipse cx="0" cy="0" rx="17" ry="9" fill="#8A6A4A" /><circle cx="16" cy="-5" r="7" fill="#8A6A4A" /><circle cx="19" cy="-7" r="1.4" fill="#0B1730" />
          <rect x="-11" y="5" width="4" height="7" fill="#6E5238" /><rect x="7" y="5" width="4" height="7" fill="#6E5238" />
        </g>
        <g transform={parado ? "translate(200 60)" : undefined}>
          <AM path="M-30 70 C80 40 180 90 260 52 S380 60 440 40" dur="9s" />
          <path d="M-8 0 Q-4 -5 0 0 Q4 -5 8 0" fill="none" stroke="#F3EAD3" strokeWidth="2" strokeLinecap="round">
            <A attributeName="d" values="M-8 0 Q-4 -5 0 0 Q4 -5 8 0;M-8 -2 Q-4 3 0 0 Q4 3 8 -2;M-8 0 Q-4 -5 0 0 Q4 -5 8 0" dur=".7s" />
          </path>
        </g>
        {!parado && (
          <g>
            <AM path="M150 190 Q160 160 172 190" dur="3.2s" keyPoints="0;1;1" keyTimes="0;.5;1" calcMode="linear" />
            <path d="M-6 0 Q0 -5 6 0 Q0 5 -6 0 M6 0 L10 -3 L10 3Z" fill="#DAA14E" />
          </g>
        )}
      </svg>
    );

  if (tema === "Economia")
    return (
      <svg {...svgBase}>
        <rect width="400" height="200" fill="#1A1C2E" />
        <path d="M0 60H400M0 100H400M0 140H400" stroke="#2A2F4A" strokeWidth="1" />
        <g fill="#DAA14E">
          <rect x="60" y="120" width="28" height="60" rx="4"><A attributeName="height" values="20;60;60" dur="3s" /><A attributeName="y" values="160;120;120" dur="3s" /></rect>
          <rect x="104" y="100" width="28" height="80" rx="4" opacity=".85"><A attributeName="height" values="20;80;80" dur="3s" begin=".2s" /><A attributeName="y" values="160;100;100" dur="3s" begin=".2s" /></rect>
          <rect x="148" y="78" width="28" height="102" rx="4" opacity=".7"><A attributeName="height" values="20;102;102" dur="3s" begin=".4s" /><A attributeName="y" values="160;78;78" dur="3s" begin=".4s" /></rect>
        </g>
        <path d="M200 150 L240 128 L270 138 L310 96 L350 70" fill="none" stroke="#46C28E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="200" strokeDashoffset={parado ? 0 : 200}>
          <A attributeName="stroke-dashoffset" values="200;0;0" dur="3s" />
        </path>
        {!parado && (
          <>
            <g><AT attributeName="transform" type="translate" values="0 -40;0 150" dur="2.6s" /><ellipse cx="300" cy="20" rx="11" ry="11" fill="#F0C27A" stroke="#B9823A" strokeWidth="2" /></g>
            <g><AT attributeName="transform" type="translate" values="0 -60;0 150" dur="3.4s" begin="1s" /><ellipse cx="360" cy="10" rx="9" ry="9" fill="#F0C27A" stroke="#B9823A" strokeWidth="2" /></g>
          </>
        )}
        <path d="M0 180 H400" stroke="#3A4064" strokeWidth="2" />
      </svg>
    );

  if (tema === "Educação")
    return (
      <svg {...svgBase}>
        <rect width="400" height="200" fill="#231A33" />
        <rect x="40" y="40" width="200" height="110" rx="6" fill="#1D3A2E" stroke="#5A4330" strokeWidth="6" />
        <path d="M62 80 H200 M62 104 H170 M62 128 H190" stroke="#E8E2D0" strokeWidth="3" strokeLinecap="round" strokeDasharray="140" strokeDashoffset={parado ? 0 : 140} opacity=".8">
          <A attributeName="stroke-dashoffset" values="140;0;0" dur="4s" />
        </path>
        <g transform="translate(300 178)">
          <rect x="-50" y="-14" width="100" height="14" rx="2" fill="#7FA7E8" />
          <rect x="-44" y="-28" width="90" height="14" rx="2" fill="#E8A07F" />
          <rect x="-48" y="-42" width="94" height="14" rx="2" fill="#46C28E" />
          <g>
            <AT attributeName="transform" type="translate" values="0 0;0 -6;0 0" dur="2.6s" />
            <path d="M-30 -58 L0 -70 L30 -58 L0 -46Z" fill="#0B1730" stroke="#DAA14E" strokeWidth="2" />
            <path d="M22 -55 V-40" stroke="#DAA14E" strokeWidth="2" /><circle cx="22" cy="-38" r="3" fill="#DAA14E" />
          </g>
        </g>
        <g>
          <AT attributeName="transform" type="translate" values="0 0;110 0;0 0" dur="4s" />
          <g transform="translate(70 150) rotate(-35)"><rect x="0" y="-4" width="44" height="8" fill="#DAA14E" /><path d="M44 -4 L54 0 L44 4Z" fill="#F3EAD3" /></g>
        </g>
        <path d="M0 186 H400" stroke="#3A2E4E" strokeWidth="2" />
      </svg>
    );

  if (tema === "Saúde")
    return (
      <svg {...svgBase}>
        <rect width="400" height="200" fill="#2A1A24" />
        <path d="M0 110 H110 L128 70 L146 150 L164 92 L176 110 H400" fill="none" stroke="#F07A65" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="420" strokeDashoffset={parado ? 0 : 420}>
          <A attributeName="stroke-dashoffset" values="420;0;-420" dur="3s" />
        </path>
        <g transform="translate(300 96)">
          <path d="M0 30 C-40 4 -34 -30 -12 -30 C-4 -30 0 -22 0 -18 C0 -22 4 -30 12 -30 C34 -30 40 4 0 30Z" fill="#F07A65">
            <AT attributeName="transform" type="scale" values="1;1.12;1;1.06;1" dur="1.2s" />
          </path>
        </g>
        <g transform="translate(70 46)" fill="#F3EAD3" opacity=".9"><rect x="-6" y="-18" width="12" height="36" rx="2" /><rect x="-18" y="-6" width="36" height="12" rx="2" /></g>
        <path d="M0 186 H400" stroke="#4A2E3C" strokeWidth="2" />
      </svg>
    );

  if (tema === "Segurança")
    return (
      <svg {...svgBase}>
        <rect width="400" height="200" fill="#0D1530" />
        <g fill="#F3EAD3">
          <circle cx="40" cy="30" r="1.5"><A attributeName="opacity" values="1;.2;1" dur="2s" /></circle>
          <circle cx="140" cy="22" r="1.2" />
          <circle cx="250" cy="36" r="1.5"><A attributeName="opacity" values=".2;1;.2" dur="3s" /></circle>
          <circle cx="360" cy="18" r="1.2" />
        </g>
        <path d="M0 140 H30 V110 H70 V140 H90 V96 H140 V140 H170 V120 H210 V140 H400 V200 H0Z" fill="#1A2550" />
        <g fill="#DAA14E" opacity=".8">
          <rect x="40" y="118" width="8" height="8" /><rect x="104" y="106" width="8" height="8"><A attributeName="opacity" values="1;0;1" dur="5s" /></rect>
          <rect x="120" y="120" width="8" height="8" /><rect x="184" y="128" width="8" height="8" />
        </g>
        <g transform="translate(270 0)">
          <rect x="-3" y="70" width="6" height="120" fill="#4A5578" />
          <path d="M0 70 Q0 56 18 56" fill="none" stroke="#4A5578" strokeWidth="5" />
          <path d="M14 56 H30 L26 64 H18Z" fill="#F3EAD3" />
          <path d="M18 64 L-30 186 H80 L26 64Z" fill="#F0C27A" opacity=".18"><A attributeName="opacity" values=".18;.3;.18" dur="3s" /></path>
        </g>
        <g transform="translate(350 120)">
          <path d="M0 -34 L26 -24 V0 C26 18 14 28 0 34 C-14 28 -26 18 -26 0 V-24Z" fill="#11224A" stroke="#7FA7E8" strokeWidth="3" />
          <path d="M-10 0 L-2 8 L12 -8" fill="none" stroke="#46C28E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="34" strokeDashoffset={parado ? 0 : 34}>
            <A attributeName="stroke-dashoffset" values="34;0;0" dur="2.5s" />
          </path>
        </g>
        <path d="M0 186 H400" stroke="#26315C" strokeWidth="2" />
      </svg>
    );

  if (tema === "Saneamento")
    return (
      <svg {...svgBase}>
        <rect width="400" height="200" fill="#0E2A3E" />
        <path d="M0 40 H150 Q170 40 170 60 V74" fill="none" stroke="#7A8AA8" strokeWidth="14" strokeLinecap="round" />
        <rect x="156" y="72" width="28" height="12" rx="3" fill="#A3AEC8" />
        {!parado && (
          <g fill="#5FB7D4">
            <path d="M170 92 q-6 10 0 14 q6 -4 0 -14Z"><AT attributeName="transform" type="translate" values="0 0;0 70" dur="1.2s" /><A attributeName="opacity" values="1;1;0" dur="1.2s" /></path>
            <path d="M170 92 q-6 10 0 14 q6 -4 0 -14Z"><AT attributeName="transform" type="translate" values="0 0;0 70" dur="1.2s" begin=".6s" /><A attributeName="opacity" values="1;1;0" dur="1.2s" begin=".6s" /></path>
          </g>
        )}
        <g>
          <AT attributeName="transform" type="translate" values="0 0;-80 0" dur="4s" />
          <path d="M0 172 Q20 162 40 172 T80 172 T120 172 T160 172 T200 172 T240 172 T280 172 T320 172 T360 172 T400 172 T440 172 T480 172 V200 H0Z" fill="#2E7FA6" />
        </g>
        <g>
          <AT attributeName="transform" type="translate" values="-80 0;0 0" dur="5s" />
          <path d="M0 182 Q20 174 40 182 T80 182 T120 182 T160 182 T200 182 T240 182 T280 182 T320 182 T360 182 T400 182 T440 182 T480 182 V200 H0Z" fill="#5FB7D4" opacity=".8" />
        </g>
        <g transform="translate(310 110)" fill="none" stroke="#F3EAD3" strokeWidth="3" opacity=".85">
          <circle r="20" /><path d="M-8 2 L-2 8 L10 -6" stroke="#46C28E" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    );

  // "Outros" (ou assunto desconhecido): fundo neutro com os elos da logo
  return (
    <svg {...svgBase}>
      <rect width="400" height="200" fill="#11224A" />
      <g opacity=".25" fill="none" strokeWidth="18">
        <circle cx="170" cy="100" r="52" stroke="#F3EAD3" />
        <circle cx="230" cy="100" r="52" stroke="#DAA14E" />
      </g>
    </svg>
  );
}
