// ===========================================
// AvailableTeamsCard — equipos elegibles antes de generar el fixture
// ===========================================
import { Users } from 'lucide-react';
import type { Team } from '@/types';

/**
 * Sólo tiene sentido mientras no haya fixture: una vez generado, los equipos
 * ya se ven en los partidos. La decisión de mostrarla queda en la página.
 */
export function AvailableTeamsCard({ teams }: { teams: Team[] }) {
  return (
    <div className="card p-6">
      <h3 className="font-bold text-primary-900 text-lg mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-primary-500" />
        Equipos Participantes ({teams.length})
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {teams.map((team) => (
          <div key={team.id} className="border border-primary-100 rounded-lg p-3 bg-primary-50/30">
            <p className="font-semibold text-primary-800 text-sm">{team.name}</p>
            <p className="text-xs text-primary-500">{team.locality}, {team.department}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
