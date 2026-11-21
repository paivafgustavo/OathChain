// Detecta a preferência do sistema "reduzir movimento" (e acompanha se ela mudar).
import { useEffect, useState } from "react";

export function useMovimentoReduzido() {
  const consulta = "(prefers-reduced-motion: reduce)";
  const [reduzido, setReduzido] = useState(() => typeof window !== "undefined" && window.matchMedia?.(consulta).matches);
  useEffect(() => {
    const m = window.matchMedia?.(consulta);
    if (!m) return;
    const mudou = () => setReduzido(m.matches);
    m.addEventListener("change", mudou);
    return () => m.removeEventListener("change", mudou);
  }, []);
  return reduzido;
}
