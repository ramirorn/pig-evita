// ===========================================
// PageHero — Reusable hero/banner for public pages
// ===========================================
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageHeroProps {
  title: string;
  description: string;
  icon: ReactNode;
  /** Gradient variant using existing palette colors */
  variant?: 'primary' | 'accent' | 'secondary' | 'celeste';
  /** Optional extra content (e.g. search bar, counter badge) */
  children?: ReactNode;
}

const VARIANT_STYLES = {
  primary: {
    bg: 'from-primary-800 via-primary-900 to-primary-900',
    iconBg: 'from-primary-500 to-primary-700',
    blob1: 'bg-accent-500/15',
    blob2: 'bg-celeste-400/15',
    blob3: 'bg-secondary-500/10',
    titleColor: 'text-white',
    descColor: 'text-celeste-100',
    wave: 'var(--color-surface)',
  },
  accent: {
    bg: 'from-primary-800 via-primary-900 to-primary-900',
    iconBg: 'from-accent-500 to-accent-600',
    blob1: 'bg-accent-500/20',
    blob2: 'bg-accent-300/15',
    blob3: 'bg-celeste-400/10',
    titleColor: 'text-white',
    descColor: 'text-celeste-100',
    wave: 'var(--color-surface)',
  },
  secondary: {
    bg: 'from-secondary-600 via-secondary-700 to-primary-900',
    iconBg: 'from-secondary-400 to-secondary-600',
    blob1: 'bg-secondary-300/20',
    blob2: 'bg-accent-500/15',
    blob3: 'bg-celeste-400/10',
    titleColor: 'text-white',
    descColor: 'text-secondary-100',
    wave: 'var(--color-surface)',
  },
  celeste: {
    bg: 'from-primary-700 via-primary-800 to-primary-900',
    iconBg: 'from-celeste-400 to-celeste-600',
    blob1: 'bg-celeste-400/20',
    blob2: 'bg-primary-300/15',
    blob3: 'bg-accent-500/10',
    titleColor: 'text-white',
    descColor: 'text-celeste-100',
    wave: 'var(--color-surface)',
  },
};

export function PageHero({
  title,
  description,
  icon,
  variant = 'primary',
  children,
}: PageHeroProps) {
  const styles = VARIANT_STYLES[variant];

  return (
    <section
      className={cn(
        'relative overflow-hidden bg-gradient-to-br text-white',
        styles.bg,
      )}
    >
      {/* Decorative blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className={cn(
            'absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl animate-float',
            styles.blob1,
          )}
        />
        <div
          className={cn(
            'absolute -bottom-16 -left-16 w-80 h-80 rounded-full blur-3xl animate-float-delayed',
            styles.blob2,
          )}
        />
        <div
          className={cn(
            'absolute top-1/2 left-1/3 w-56 h-56 rounded-full blur-2xl',
            styles.blob3,
          )}
        />
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
            backgroundSize: '32px 32px',
          }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 md:py-20">
        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div
            className={cn(
              'w-18 h-18 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg mb-6 animate-scale-in',
              styles.iconBg,
            )}
            style={{ width: '4.5rem', height: '4.5rem' }}
          >
            {icon}
          </div>

          {/* Title */}
          <h1
            className={cn(
              'text-3xl md:text-4xl lg:text-5xl font-extrabold tracking-tight mb-4 animate-fade-in',
              styles.titleColor,
            )}
          >
            {title}
          </h1>

          {/* Description */}
          <p
            className={cn(
              'text-lg md:text-xl max-w-2xl leading-relaxed animate-fade-in stagger-1',
              styles.descColor,
            )}
          >
            {description}
          </p>

          {/* Optional extra content */}
          {children && (
            <div className="mt-8 w-full max-w-xl animate-fade-in stagger-2">
              {children}
            </div>
          )}
        </div>
      </div>

      {/* Wave separator */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1440 60"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full"
          preserveAspectRatio="none"
        >
          <path
            d="M0 60V20C360 50 720 0 1080 20C1260 30 1380 15 1440 20V60H0Z"
            fill={styles.wave}
          />
        </svg>
      </div>
    </section>
  );
}
