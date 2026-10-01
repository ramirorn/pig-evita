// ===========================================
// useFullscreen — pantalla completa de un contenedor, con alternativa en capa
// ===========================================
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  chooseFullscreenMode,
  scrollbarCompensation,
  type FullscreenMode,
} from '@/lib/fullscreenMode';

/** Lo que Safari expone con prefijo (iPad y escritorio). */
type ElementoConWebkit = HTMLElement & { webkitRequestFullscreen?: () => Promise<void> | void };
type DocumentoConWebkit = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
  webkitFullscreenEnabled?: boolean;
};

const elementoEnPantallaCompleta = () => {
  const d = document as DocumentoConWebkit;
  return d.fullscreenElement ?? d.webkitFullscreenElement ?? null;
};

/**
 * Pone un contenedor en pantalla completa.
 *
 * - **Nativo** (Fullscreen API, con o sin prefijo webkit) cuando el navegador
 *   lo permite. El estado se sincroniza con `fullscreenchange`, porque el
 *   navegador también sale solo (Escape).
 * - **Capa** (`overlay`) en el iPhone, que no deja poner en pantalla completa un
 *   elemento, o si la llamada falla. El componente la dibuja como capa fija;
 *   acá se bloquea el scroll de atrás (compensando la barra) y se marca `inert`
 *   todo lo que no es el contenedor ni sus ancestros.
 *
 * La decisión entre los dos modos es pura (`chooseFullscreenMode`).
 */
export function useFullscreen(ref: RefObject<HTMLElement | null>) {
  const [modo, setModo] = useState<FullscreenMode | null>(null);
  const modoRef = useRef(modo);
  modoRef.current = modo;

  // El navegador sale solo (Escape, gesto): se refleja en el estado.
  useEffect(() => {
    const sincronizar = () => {
      if (modoRef.current === 'native' && elementoEnPantallaCompleta() !== ref.current) setModo(null);
    };
    document.addEventListener('fullscreenchange', sincronizar);
    document.addEventListener('webkitfullscreenchange', sincronizar);
    return () => {
      document.removeEventListener('fullscreenchange', sincronizar);
      document.removeEventListener('webkitfullscreenchange', sincronizar);
    };
  }, [ref]);

  // Capa: sin scroll detrás y el resto de la página inerte.
  useEffect(() => {
    const el = ref.current;
    if (modo !== 'overlay' || !el) return;
    const html = document.documentElement;
    const antes = { overflow: html.style.overflow, paddingRight: html.style.paddingRight };
    const compensacion = scrollbarCompensation(window.innerWidth, html.clientWidth);
    html.style.overflow = 'hidden';
    if (compensacion > 0) html.style.paddingRight = `${compensacion}px`;

    const inertes: HTMLElement[] = [];
    for (let nodo: HTMLElement | null = el; nodo && nodo !== document.body; nodo = nodo.parentElement) {
      const padre: HTMLElement | null = nodo.parentElement;
      if (!padre) break;
      for (const hermano of Array.from(padre.children)) {
        if (hermano !== nodo && hermano instanceof HTMLElement && !hermano.inert) {
          hermano.inert = true;
          inertes.push(hermano);
        }
      }
    }
    return () => {
      html.style.overflow = antes.overflow;
      html.style.paddingRight = antes.paddingRight;
      for (const h of inertes) h.inert = false;
    };
  }, [modo, ref]);

  const entrar = useCallback(async () => {
    const el = ref.current as ElementoConWebkit | null;
    if (!el) return;
    const d = document as DocumentoConWebkit;
    const elegido = chooseFullscreenMode({
      standard: typeof el.requestFullscreen === 'function',
      webkit: typeof el.webkitRequestFullscreen === 'function',
      enabled: Boolean(d.fullscreenEnabled ?? d.webkitFullscreenEnabled),
    });
    if (elegido === 'native') {
      try {
        if (typeof el.requestFullscreen === 'function') await el.requestFullscreen();
        else await el.webkitRequestFullscreen?.();
        setModo('native');
        return;
      } catch {
        // Se negó (permiso, iframe): se cae a la capa.
      }
    }
    setModo('overlay');
  }, [ref]);

  const salir = useCallback(async () => {
    const d = document as DocumentoConWebkit;
    if (modoRef.current === 'native' && elementoEnPantallaCompleta()) {
      try {
        if (typeof d.exitFullscreen === 'function') await d.exitFullscreen();
        else await d.webkitExitFullscreen?.();
      } catch {
        // Ya había salido.
      }
    }
    setModo(null);
  }, []);

  return { activo: modo !== null, modo, entrar, salir };
}
