// ===========================================
// Supresión por k-anonimato — cómo se muestra un dato que no se publica (S20)
// ===========================================
//
// Es lo más importante de todo el tablero, así que vive en un archivo propio y
// se usa en **todos** los lugares donde puede aparecer un `CorteEncuesta`.
//
// La regla, en una línea: un corte suprimido **no es un cero y no se esconde**.
//
//   · Pintarlo como 0 miente sobre un dato que existe, e invita a sumar los
//     cortes visibles y despejar el suprimido por resta.
//   · Esconder la fila hace desaparecer de la vista a las localidades chicas,
//     que son justamente las que más interesa mirar.
//
// Por eso la fila se muestra siempre, con el conteo reemplazado por una marca
// explícita y una explicación al alcance del mouse y del lector de pantalla. El
// `umbral` viene en la respuesta del backend (`UMBRAL_K_ANONIMATO`) y se usa
// tal cual: acá no hay ningún 5 escrito a mano.

import { EyeOff } from 'lucide-react';
import type { CorteEncuesta } from '@/types';
// El texto vive en `surveyRules` y no acá: este archivo sólo exporta
// componentes, para no sumar un warning de Fast Refresh.
import { textoSupresion } from './surveyRules';

interface ConteoCorteProps {
  corte: CorteEncuesta;
  umbral: number;
  /** Alineación del número dentro de su celda. */
  className?: string;
}

/**
 * El conteo de un corte, publicado o suprimido.
 *
 * La marca es visual (ícono + "Sin publicar") **y** textual: el `title` explica
 * el motivo al pasar el mouse y el `<span class="sr-only">` se lo lee completo a
 * quien usa lector de pantalla, que de otro modo escucharía sólo "sin publicar".
 */
export function ConteoCorte({ corte, umbral, className }: ConteoCorteProps) {
  if (!corte.suprimido) {
    return (
      <span className={className ?? 'font-semibold text-primary-900 tabular-nums'}>
        {corte.conteo.toLocaleString('es-AR')}
      </span>
    );
  }

  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border border-accent-300 bg-accent-50 px-2 py-0.5 text-xs font-semibold text-accent-800"
      title={textoSupresion(umbral)}
    >
      <EyeOff className="h-3.5 w-3.5" aria-hidden="true" />
      Sin publicar
      <span className="sr-only">. {textoSupresion(umbral)}</span>
    </span>
  );
}

interface NotaSupresionProps {
  umbral: number;
  /** Cuántas filas del bloque vinieron suprimidas, si se sabe. */
  suprimidas?: number;
}

/**
 * Aclaración al pie de un bloque que puede traer celdas suprimidas.
 *
 * Va siempre, haya o no celdas suprimidas a la vista: quien mira el tablero
 * tiene que saber que los números pueden no sumar el total **antes** de sacar
 * una conclusión, no después de encontrar la primera celda rara.
 */
export function NotaSupresion({ umbral, suprimidas }: NotaSupresionProps) {
  return (
    <p className="mt-3 flex items-start gap-2 rounded-lg border border-primary-100 bg-primary-50/60 px-3 py-2 text-xs leading-relaxed text-primary-700">
      <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-500" aria-hidden="true" />
      <span>
        {suprimidas !== undefined && suprimidas > 0 ? (
          <>
            <strong className="font-semibold">
              {suprimidas === 1
                ? 'Hay 1 fila sin publicar.'
                : `Hay ${suprimidas} filas sin publicar.`}
            </strong>{' '}
          </>
        ) : null}
        Los cruces con menos de {umbral} respuestas no muestran el número. No es
        que sean cero: es que con tan pocas respuestas, y siendo menores de edad
        quienes contestan, el cruce de disciplina, localidad y etapa alcanza para
        identificar a un chico. Por eso los totales pueden no coincidir con la
        suma de las filas.
      </span>
    </p>
  );
}

/**
 * Cartel para cuando el corte **entero** viene suprimido.
 *
 * Distinto del vacío a propósito: "todavía nadie contestó" y "contestaron, pero
 * son tan pocos que no se puede publicar el detalle" llevan a decisiones
 * distintas —esperar en un caso, ampliar el filtro en el otro— y el tablero
 * tiene que decir cuál de las dos es.
 */
export function CorteSuprimidoEntero({
  umbral,
  totalRespuestas,
  hayFiltros,
}: {
  umbral: number;
  totalRespuestas: number;
  hayFiltros: boolean;
}) {
  return (
    <div className="rounded-xl border border-accent-300 bg-accent-50/70 p-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-100 text-accent-800">
        <EyeOff className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="text-base font-bold text-primary-900">
        Los resultados de este recorte no se pueden mostrar
      </h3>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-primary-700">
        Hay {totalRespuestas === 1 ? '1 respuesta' : `${totalRespuestas} respuestas`} en
        este recorte y hacen falta al menos {umbral} para publicar el detalle.
        Quienes contestan son menores de edad: con una muestra tan chica,
        mostrar qué se eligió equivale a decir quién lo eligió.
      </p>
      {hayFiltros && (
        <p className="mt-3 text-sm font-medium text-primary-800">
          Probá sacar algún filtro para mirar un grupo más grande.
        </p>
      )}
    </div>
  );
}
