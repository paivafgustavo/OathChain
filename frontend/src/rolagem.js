// Rolagem suave com inércia (biblioteca Lenis).
// Por quê: a roda do mouse pula ~100 px por "clique"; como as animações da página inicial
// seguem a posição da rolagem, cada pulo virava um tranco. O Lenis espalha esse pulo por
// alguns quadros, e as animações passam a deslizar. A posição continua sendo a rolagem
// normal da página, então as animações em CSS (scroll-driven) funcionam igual.
// No celular (toque) e com "reduzir movimento" fica a rolagem nativa do sistema.
import { useEffect } from "react";
import Lenis from "lenis";
import "lenis/dist/lenis.css";

let lenis = null;

export function useRolagemSuave(desligada) {
  useEffect(() => {
    if (desligada) return;
    lenis = new Lenis({
      autoRaf: true,
      lerp: 0.09, // quanto menor, mais "macio" (e mais demorado) fica o deslize
      wheelMultiplier: 0.9,
      allowNestedScroll: true, // caixas com rolagem própria (prateleiras, listas) continuam rolando por dentro
      anchors: true,
    });
    return () => {
      lenis.destroy();
      lenis = null;
    };
  }, [desligada]);
}

// Volta ao topo na troca de página (sem deslizar, para não tocar a abertura ao contrário)
export function irAoTopo() {
  if (lenis) lenis.scrollTo(0, { immediate: true, force: true });
  else window.scrollTo(0, 0);
}
