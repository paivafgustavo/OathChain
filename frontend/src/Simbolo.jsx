// Símbolo da logo em vetor: anel creme entrelaçado a um C dourado, com um ponto entre as pontas do C.
// Os vãos dos cruzamentos são MÁSCARAS (recorte transparente), então funcionam sobre qualquer fundo:
// na metade de cima o C passa por cima do anel; na de baixo, o anel passa por cima do C.
// As pontas do C são cortadas por uma faixa horizontal, como na logo.
import { useId } from "react";

const CREME = "#F3EAD3";
const OURO = "#DAA14E";

// partes: "creme" | "ouro" | "ponto" | "tudo" (entrelaçado). Assim a abertura anima cada peça.
export default function Simbolo({ parte = "tudo", className, style, rotulo }) {
  const id = useId().replace(/:/g, "");
  const acessivel = rotulo ? { role: "img", "aria-label": rotulo } : { "aria-hidden": true };
  return (
    <svg viewBox="0 0 512 312" className={className} style={style} {...acessivel}>
      <defs>
        <mask id={id + "pontas"} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="312">
          <rect width="512" height="312" fill="#fff" />
          <rect x="342" y="103" width="190" height="110" fill="#000" />
        </mask>
        <mask id={id + "creme"} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="312">
          <rect width="512" height="312" fill="#fff" />
          <circle cx="342" cy="158" r="126" fill="none" stroke="#000" strokeWidth="74" />
          <rect x="0" y="158" width="512" height="154" fill="#fff" />
        </mask>
        <mask id={id + "ouro"} maskUnits="userSpaceOnUse" x="0" y="0" width="512" height="312">
          <rect width="512" height="312" fill="#fff" />
          <circle cx="165" cy="158" r="126" fill="none" stroke="#000" strokeWidth="74" />
          <rect x="0" y="0" width="512" height="158" fill="#fff" />
          <rect x="342" y="103" width="190" height="110" fill="#000" />
        </mask>
      </defs>
      {parte === "creme" && <circle cx="165" cy="158" r="126" fill="none" stroke={CREME} strokeWidth="58" />}
      {parte === "ouro" && <circle cx="342" cy="158" r="126" fill="none" stroke={OURO} strokeWidth="58" mask={`url(#${id}pontas)`} />}
      {parte === "ponto" && <circle className="simbolo-ponto" cx="455" cy="158" r="31" fill={OURO} />}
      {(parte === "tudo" || parte === "entrelacado") && (
        <>
          <circle cx="165" cy="158" r="126" fill="none" stroke={CREME} strokeWidth="58" mask={`url(#${id}creme)`} />
          <circle cx="342" cy="158" r="126" fill="none" stroke={OURO} strokeWidth="58" mask={`url(#${id}ouro)`} />
          {parte === "tudo" && <circle cx="455" cy="158" r="31" fill={OURO} />}
        </>
      )}
    </svg>
  );
}
