// ===========================================
// Home Page — Public Landing
// ===========================================
import { HomeHero } from './home/HomeHero';
import { QuickLinksSection } from './home/QuickLinksSection';
import { StatsSection } from './home/StatsSection';
import { LatestNewsSection } from './home/LatestNewsSection';
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

      {/* Cifras de la edición.
          Va inmediatamente después del hero **por diseño**: se monta sobre él
          con un margen negativo que depende del `pb` del hero. Meter una sección
          en el medio rompe el solapamiento. */}
      <StatsSection />

      {/* Quick Links Grid */}
      <QuickLinksSection />

      {/* Latest News Section */}
      <LatestNewsSection />

      {/* CTA */}
      <HomeCtaSection />
    </div>
  );
}
