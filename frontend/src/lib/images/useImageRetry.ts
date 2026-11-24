// ===========================================
// useImageRetry — un reintento antes del placeholder (S9)
// ===========================================
//
// Envoltorio React de las decisiones puras de `imageRules.ts`
// (`registrarFalloImagen`, `reintentarImagen`, `debeMostrarImagen`), que son
// las que fija `check:venues`. Lo usan la foto de sede y la imagen de noticia.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ESTADO_CARGA_INICIAL,
  debeMostrarImagen,
  registrarFalloImagen,
  reintentarImagen,
} from './imageRules';

export function useImageRetry(src: string | null): {
  /** `false`: pintar el placeholder. */
  mostrar: boolean;
  /** Para el `onError` del `<img>`. */
  onError: () => void;
} {
  const [estado, setEstado] = useState(ESTADO_CARGA_INICIAL);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Al desmontar (o cambiar de url) no queda un reintento colgado.
  useEffect(
    () => () => {
      if (temporizador.current !== null) clearTimeout(temporizador.current);
      temporizador.current = null;
    },
    [src],
  );

  const onError = useCallback(() => {
    if (src === null) return;
    // Se decide sobre el estado de este render: el `<img>` que falló es el de
    // este `src`, y la decisión no tiene que vivir dentro de un updater (que
    // React puede llamar dos veces).
    const { estado: nuevo, reintentarEnMs } = registrarFalloImagen(estado, src);
    setEstado(nuevo);
    if (reintentarEnMs === null) return;
    if (temporizador.current !== null) clearTimeout(temporizador.current);
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      setEstado((previo) => reintentarImagen(previo, src));
    }, reintentarEnMs);
  }, [estado, src]);

  return { mostrar: debeMostrarImagen(estado, src), onError };
}
