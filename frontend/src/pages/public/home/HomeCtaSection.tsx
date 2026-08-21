// ===========================================
// HomeCtaSection — cierre de la landing con llamada a inscribirse
// ===========================================
import { Link } from 'react-router';
import { ClipboardList } from 'lucide-react';
import { ROUTES } from '@/lib/constants';

export function HomeCtaSection() {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-secondary-500 to-secondary-600 p-8 md:p-12 text-white text-center shadow-lg">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-20 -right-20 w-60 h-60 bg-white/10 rounded-full blur-2xl animate-float" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-white/5 rounded-full blur-2xl animate-float-delayed" />
        </div>
        <div className="relative">
          <h2 className="text-2xl md:text-3xl font-bold mb-3">
            ¿Listo para competir?
          </h2>
          <p className="text-secondary-100 max-w-lg mx-auto mb-6">
            Inscribite en los Juegos Evita y representá a tu localidad en las competencias deportivas provinciales.
          </p>
          <Link
            to={ROUTES.INSCRIPTION}
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-bold rounded-xl bg-white text-secondary-700 hover:bg-secondary-50 shadow-lg hover:shadow-xl transition-all"
          >
            <ClipboardList className="w-5 h-5" />
            Inscribirse
          </Link>
        </div>
      </div>
    </section>
  );
}
