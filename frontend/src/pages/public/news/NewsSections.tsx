// ===========================================
// Secciones de la portada de /noticias
// ===========================================
import type { ReactNode } from 'react';
import type { News } from '@/types';
import { NewsCard } from './NewsCard';
import { NewsMosaicCard } from './NewsMosaicCard';

/**
 * Encabezado de sección con una regla corta arriba (no es un estado: es sólo
 * jerarquía, así que no va como borde lateral de color).
 */
export function TituloDeSeccion({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="type-h2 mb-4 relative pt-3 before:absolute before:top-0 before:left-0 before:h-0.5 before:w-10 before:rounded-full before:bg-primary-600 before:content-[''] text-primary-900"
    >
      {children}
    </h2>
  );
}

/**
 * Mosaico: una grande que ocupa dos filas y las demás en 2×2 (con 5), o una
 * grande y dos apiladas (con 3). En celular, todas una debajo de la otra.
 */
export function Mosaico({ noticias }: { noticias: readonly News[] }) {
  const [grande, ...chicas] = noticias;
  if (!grande) return null;
  const completo = chicas.length >= 4;

  return (
    <div
      className={
        completo
          ? 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:grid-rows-[14rem_14rem]'
          : 'grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-rows-[14rem_14rem]'
      }
    >
      <div
        className={
          completo
            ? 'min-h-72 sm:col-span-2 md:col-span-1 md:row-span-2'
            : 'min-h-72 sm:row-span-2'
        }
      >
        <NewsMosaicCard news={grande} tamano="grande" />
      </div>
      {chicas.map((n) => (
        <div key={n.id}>
          <NewsMosaicCard news={n} />
        </div>
      ))}
    </div>
  );
}

export function GrillaDeNotas({ noticias }: { noticias: readonly News[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {noticias.map((n) => (
        <li key={n.id}>
          <NewsCard news={n} />
        </li>
      ))}
    </ul>
  );
}
