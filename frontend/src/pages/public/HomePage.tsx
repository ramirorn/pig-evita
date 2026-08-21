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

      {/* Quick Links Grid */}
      <QuickLinksSection />

      {/* Stats Section */}
      <StatsSection />

      {/* Latest News Section */}
      <LatestNewsSection />

      {/* CTA */}
      <HomeCtaSection />
    </div>
  );
}
