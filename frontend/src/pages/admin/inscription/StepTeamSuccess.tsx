// ===========================================
// Paso 4: Credenciales emitidas del plantel
// ===========================================
import { CheckCircle2, QrCode, Copy, Printer, UserPlus, Star } from 'lucide-react';
import { toast } from 'sonner';
import type { TeamInscriptionMember } from '@/types';
import { copiarAlPortapapeles, MENSAJE_COPIA_FALLIDA } from '@/lib/clipboard';
import type { TeamInscriptionWizard } from './useTeamInscriptionWizard';
import { TeamInscriptionDocuments } from '@/components/documents/InscriptionDocuments';

async function copiarCodigo(codigo: string) {
  // El toast verde sale **después** de que la promesa resolvió (R26): cantar el
  // éxito sin esperar deja al encargado con el portapapeles vacío.
  const copiado = await copiarAlPortapapeles(codigo, 'StepTeamSuccess.copiarCodigo');
  if (copiado) {
    toast.success('Código copiado al portapapeles');
    return;
  }
  toast.error(MENSAJE_COPIA_FALLIDA);
}

function Credencial({ member }: { member: TeamInscriptionMember }) {
  return (
    <li className="card overflow-hidden border border-primary-200 shadow-sm bg-white break-inside-avoid">
      <div className="p-4 flex items-center gap-4">
        {member.qrImage ? (
          <img
            src={member.qrImage}
            alt={`Código QR de la credencial ${member.qrCode}`}
            width={96}
            height={96}
            loading="lazy"
            className="w-24 h-24 rounded-xl border border-primary-100 flex-shrink-0"
          />
        ) : (
          <div className="w-24 h-24 bg-primary-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <QrCode className="w-8 h-8 text-primary-400" aria-hidden="true" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="font-extrabold text-primary-900 leading-tight truncate">
            {member.lastName}, {member.firstName}
            {member.isCaptain && (
              <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-accent-700 bg-accent-50 px-1.5 py-0.5 rounded-md align-middle">
                <Star className="w-3 h-3" aria-hidden="true" />
                Capitán
              </span>
            )}
          </p>
          <p className="text-xs text-primary-600 font-medium">
            DNI: {member.dni} · {member.isSubstitute ? 'Suplente' : 'Titular'}
            {typeof member.shirtNumber === 'number' ? ` · N° ${member.shirtNumber}` : ''}
          </p>
          <div className="mt-2 flex items-center gap-2">
            <span className="font-mono text-xs font-extrabold text-primary-900 bg-surface px-2 py-1 rounded-lg border border-primary-200">
              {member.qrCode}
            </span>
            <button
              type="button"
              onClick={() => void copiarCodigo(member.qrCode)}
              aria-label={`Copiar el código ${member.qrCode}`}
              className="p-1.5 rounded-lg text-primary-500 hover:text-primary-800 hover:bg-primary-100 transition-colors print:hidden"
            >
              <Copy className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </li>
  );
}

export function StepTeamSuccess({ wizard }: { wizard: TeamInscriptionWizard }) {
  const resultado = wizard.resultado;
  const credenciales = resultado?.members ?? [];

  return (
    <div className="max-w-3xl mx-auto animate-scale-in space-y-6">
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-secondary-50 flex items-center justify-center border-4 border-secondary-200 shadow-sm">
          <CheckCircle2 className="w-9 h-9 text-secondary-600" aria-hidden="true" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-primary-900 tracking-tight">
          Plantel inscripto
        </h2>
        <p className="text-primary-600 text-sm mt-1 max-w-lg mx-auto">
          Se emitieron {credenciales.length} credenciales para{' '}
          <span className="font-bold text-primary-800">
            {resultado?.team.name ?? wizard.equipo.teamName}
          </span>
          {resultado && (
            <>
              {' '}
              ({resultado.totals.titulares} titulares y {resultado.totals.suplentes} suplentes en{' '}
              {resultado.discipline.name} {resultado.category.name})
            </>
          )}
          . Cada integrante necesita la suya para el control en las sedes.
        </p>
      </div>

      {credenciales.length === 0 ? (
        <div className="card p-6 text-center text-sm text-primary-600 shadow-sm">
          El plantel quedó inscripto, pero el sistema no devolvió las credenciales. Las vas a
          encontrar en el listado de Inscripciones.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {credenciales.map((member) => (
            <Credencial key={member.inscriptionId} member={member} />
          ))}
        </ul>
      )}

      {/* Papeles por integrante: opcionales, el plantel ya quedó inscripto. */}
      <TeamInscriptionDocuments members={credenciales} />

      <div className="flex flex-wrap items-center justify-center gap-3 print:hidden">
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-primary-800 bg-white border border-primary-200 hover:bg-primary-50 transition-all"
        >
          <Printer className="w-3.5 h-3.5" aria-hidden="true" />
          Imprimir todas las credenciales
        </button>
        <button
          type="button"
          onClick={wizard.limpiarTodo}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-primary-800 hover:bg-primary-900 shadow-sm transition-all"
        >
          <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
          Inscribir otro plantel
        </button>
      </div>
    </div>
  );
}
