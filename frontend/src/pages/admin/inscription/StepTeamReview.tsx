// ===========================================
// Paso 3: Confirmación del plantel completo
// ===========================================
import { useState } from 'react';
import { FileCheck2, ArrowLeft, CheckCircle2, Star, Users, Trophy } from 'lucide-react';
import { SEX_LABELS } from '@/lib/constants';
import { calcularEdad, type RosterMember } from './rosterModel';
import type { TeamInscriptionWizard } from './useTeamInscriptionWizard';

function ListaIntegrantes({
  titulo,
  integrantes,
}: {
  titulo: string;
  integrantes: RosterMember[];
}) {
  if (integrantes.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-bold text-primary-500 uppercase tracking-wider mb-2">
        {titulo} ({integrantes.length})
      </h3>
      <ul className="space-y-1.5">
        {integrantes.map((integrante, indice) => {
          const edad = calcularEdad(integrante.birthDate);
          return (
            <li
              key={integrante.id}
              className="flex items-center gap-3 text-sm text-primary-800 px-3 py-2 rounded-lg bg-surface border border-primary-100"
            >
              <span className="text-[11px] font-bold text-primary-400 w-5 flex-shrink-0">
                {indice + 1}
              </span>
              <span className="font-bold truncate flex-1 min-w-0">
                {integrante.lastName}, {integrante.firstName}
                {integrante.isCaptain && (
                  <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-accent-700 bg-accent-50 px-1.5 py-0.5 rounded-md align-middle">
                    <Star className="w-3 h-3" aria-hidden="true" />
                    Capitán
                  </span>
                )}
              </span>
              <span className="text-xs text-primary-600 flex-shrink-0">
                DNI {integrante.dni}
                {edad !== null ? ` · ${edad} años` : ''}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function StepTeamReview({ wizard }: { wizard: TeamInscriptionWizard }) {
  const [declaracionAceptada, setDeclaracionAceptada] = useState(false);

  const titulares = wizard.integrantes.filter((integrante) => !integrante.isSubstitute);
  const suplentes = wizard.integrantes.filter((integrante) => integrante.isSubstitute);

  return (
    <div className="card p-6 md:p-8 space-y-6 animate-fade-in shadow-md">
      <div className="flex items-center gap-2.5 pb-4 border-b border-primary-100 text-primary-800 font-bold text-lg">
        <FileCheck2 className="w-5 h-5 text-accent-600" aria-hidden="true" />
        <span>Paso 3: Verificación del Plantel</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-5 rounded-2xl bg-surface border border-primary-100 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-primary-500 uppercase tracking-wider">
            <Users className="w-4 h-4 text-primary-700" aria-hidden="true" />
            Equipo
          </div>
          <p className="text-lg font-bold text-primary-900">{wizard.equipo.teamName}</p>
          <div className="text-xs text-primary-700 space-y-1">
            <p>
              <span className="font-semibold">Departamento:</span> {wizard.equipo.department}
            </p>
            <p>
              <span className="font-semibold">Localidad:</span> {wizard.equipo.locality}
            </p>
            <p>
              <span className="font-semibold">Integrantes:</span> {titulares.length} titulares
              {suplentes.length > 0 ? ` y ${suplentes.length} suplentes` : ' (sin suplentes)'}
            </p>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-surface border border-primary-100 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-primary-500 uppercase tracking-wider">
            <Trophy className="w-4 h-4 text-primary-700" aria-hidden="true" />
            Inscripción Deportiva
          </div>
          <p className="text-lg font-bold text-primary-900">{wizard.selectedDiscipline?.name}</p>
          <div className="text-xs text-primary-700 space-y-1">
            <p>
              <span className="font-semibold">Categoría:</span> {wizard.selectedCategory?.name}
            </p>
            <p>
              <span className="font-semibold">Rango de edad:</span>{' '}
              {wizard.selectedCategory?.minAge} a {wizard.selectedCategory?.maxAge} años
            </p>
            {wizard.selectedCategory && (
              <p>
                <span className="font-semibold">Rama:</span>{' '}
                {SEX_LABELS[wizard.selectedCategory.sex]}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <ListaIntegrantes titulo="Titulares" integrantes={titulares} />
        <ListaIntegrantes titulo="Suplentes" integrantes={suplentes} />
      </div>

      <div className="p-4 rounded-xl bg-primary-50/70 border border-primary-100">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={declaracionAceptada}
            onChange={(e) => setDeclaracionAceptada(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-primary-300 text-primary-800 focus:ring-primary-500"
          />
          <span className="text-xs text-primary-800 leading-relaxed font-medium">
            Declaro bajo juramento que los datos de los {wizard.integrantes.length} integrantes son
            verídicos y que cuento con la autorización de sus responsables. Acepto el reglamento
            general y las normativas de los Juegos Evita Formoseños 2026.
          </span>
        </label>
      </div>

      <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-primary-100">
        <button
          type="button"
          onClick={wizard.volverAlPlantel}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-600 hover:text-primary-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Volver a corregir el plantel
        </button>

        <button
          type="button"
          onClick={() => void wizard.enviarPlantel()}
          disabled={!declaracionAceptada || wizard.isSubmitting}
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
        >
          {wizard.isSubmitting ? (
            <>
              <span
                className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                aria-hidden="true"
              />
              Inscribiendo el plantel...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-white" aria-hidden="true" />
              Inscribir a los {wizard.integrantes.length} integrantes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
