// ===========================================
// StatsSection — cifras de la edición, montadas sobre el hero
// ===========================================
import { Trophy, Medal, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface Cifra {
  Icono: LucideIcon;
  valor: string;
  etiqueta: string;
  /** La del medio se eleva un poco en escritorio, para romper la fila recta. */
  elevada?: boolean;
}

/**
 * Cifras fijas de la edición: **no vienen del backend**.
 *
 * ⚠️ Son afirmaciones institucionales que se muestran a cualquier visitante, así
 * que conviene confirmarlas con la Secretaría antes de publicar y actualizarlas
 * cada edición. Si mañana salen de la API, este arreglo se reemplaza por el hook
 * y el resto del componente no cambia.
 */
const CIFRAS: Cifra[] = [
  { Icono: Trophy, valor: '+40', etiqueta: 'Disciplinas' },
  {
    Icono: Medal,
    valor: '3 Etapas',
    etiqueta: 'Local, Departamental, Provincial',
    elevada: true,
  },
  { Icono: Users, valor: '+15.000', etiqueta: 'Atletas' },
];

/**
 * Franja de cifras que se solapa con el hero.
 *
 * El margen negativo depende del `pb` del hero: van juntas y en ese orden. En
 * mobile se apilan sin solaparse, porque tres tarjetas montadas sobre el texto
 * en una pantalla angosta lo taparían.
 */
export function StatsSection() {
  return (
    <section className="relative z-20 mx-auto mb-24 max-w-7xl px-4 sm:px-6 lg:px-8">
      <div className="grid -mt-32 grid-cols-1 gap-8 md:grid-cols-3">
        {CIFRAS.map(({ Icono, valor, etiqueta, elevada }) => (
          <article
            key={etiqueta}
            className={[
              'group flex transform flex-col items-center justify-center rounded-3xl border border-white/50',
              'bg-white/90 p-10 text-center shadow-[0_20px_40px_-15px_rgba(0,45,108,0.15)] backdrop-blur-xl',
              'transition-all duration-500 hover:-translate-y-2 hover:shadow-[0_30px_50px_-15px_rgba(0,45,108,0.25)]',
              elevada ? 'md:-translate-y-8' : '',
            ].join(' ')}
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-50 text-primary-800 transition-colors duration-300 group-hover:bg-accent-500 group-hover:text-primary-900">
              <Icono className="h-8 w-8" aria-hidden="true" />
            </div>
            <p className="font-display mb-2 text-3xl font-black text-primary-800">
              {valor}
            </p>
            <p className="text-sm font-semibold tracking-widest text-primary-600 uppercase">
              {etiqueta}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
