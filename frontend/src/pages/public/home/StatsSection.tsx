// ===========================================
// StatsSection — franja de cifras institucionales
// ===========================================
import { MapPin, Medal, Trophy, Users } from 'lucide-react';

// Cifras fijas de la edición: no vienen del backend todavía.
const STATS = [
  { icon: <Trophy className="w-8 h-8" />, value: '+40', label: 'Disciplinas' },
  { icon: <Users className="w-8 h-8" />, value: '3', label: 'Etapas' },
  { icon: <MapPin className="w-8 h-8" />, value: '9', label: 'Departamentos' },
  { icon: <Medal className="w-8 h-8" />, value: '∞', label: 'Oportunidades' },
];

export function StatsSection() {
  return (
    <section className="bg-primary-800 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {STATS.map((stat, idx) => (
            <div key={idx} className={`animate-fade-in stagger-${idx + 1}`}>
              <div className="w-16 h-16 mx-auto mb-3 rounded-2xl bg-white/10 flex items-center justify-center text-accent-500 shadow-inner">
                {stat.icon}
              </div>
              <p className="text-3xl md:text-4xl font-extrabold mb-1 animate-count-up" style={{ animationDelay: `${idx * 0.12}s` }}>
                {stat.value}
              </p>
              <p className="text-celeste-200 text-sm font-medium">{stat.label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
