// ===========================================
// Home Page — Public Landing
// ===========================================
import { HomeHero } from './home/HomeHero';
import { LatestNewsSection } from './home/LatestNewsSection';
import { QuickLinksSection } from './home/QuickLinksSection';
import { HomeCtaSection } from './home/HomeCtaSection';

/**
 * La landing es una secuencia de bloques independientes: la página sólo los
 * ordena y cada sección se ocupa de su markup (y de sus datos, en el caso de
 * las noticias).
 */
export function HomePage() {
  return (
    <div>
      {/* Hero Section */}
      <HomeHero />

      {/* Últimas noticias.
          Va inmediatamente después del hero **por diseño**: se monta sobre él
          con un margen negativo que depende del `pb` del hero. Meter una sección
          en el medio rompe el solapamiento. */}
      <LatestNewsSection />

      {/* Quick Links Grid */}
      <QuickLinksSection />

      {/* CTA */}
      <HomeCtaSection />
    </div>
  );
}
