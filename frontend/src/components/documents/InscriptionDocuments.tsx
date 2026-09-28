// ===========================================
// Papeles al final de la inscripción (individual y plantel)
// ===========================================
//
// Antes de confirmar no hay `participantId`, así que la carga vive en el paso
// de credenciales. No es obligatoria: la inscripción ya quedó registrada, acá
// sólo se avisa qué falta y se ofrece subirlo ahora o más tarde.
import { useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import { ChevronDown, FileText } from 'lucide-react';
import { ParticipantDocumentsPanel } from './ParticipantDocumentsPanel';
import { usePermisos } from '@/hooks/usePermisos';
import { useAuth } from '@/store/auth.store';
import { puedeVerRuta } from '@/lib/adminRoutes';
import { ROUTES } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { TeamInscriptionMember } from '@/types';

function documentsLink(participantId?: string): string {
  return participantId
    ? `${ROUTES.DOCUMENTS}?participante=${encodeURIComponent(participantId)}`
    : ROUTES.DOCUMENTS;
}

/** Permisos que deciden qué se ofrece: subir acá y/o volver después. */
function useDocumentAccess() {
  const { user } = useAuth();
  const { puede } = usePermisos();
  return {
    canUpload: puede('DOCUMENT_UPLOAD'),
    canOpenDocuments: user ? puedeVerRuta(user.role, ROUTES.DOCUMENTS) : false,
  };
}

function SectionHeader({ titleId, children }: { titleId: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 shrink-0 rounded-xl bg-primary-50 flex items-center justify-center">
        <FileText className="w-5 h-5 text-primary-600" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <h3 id={titleId} className="text-lg font-extrabold text-primary-900 leading-tight">
          DNI y ficha médica
        </h3>
        <p className="text-sm text-primary-600 mt-0.5">{children}</p>
      </div>
    </div>
  );
}

function LaterNote({ canOpenDocuments, participantId }: { canOpenDocuments: boolean; participantId?: string }) {
  if (!canOpenDocuments) return null;
  return (
    <p className="text-xs text-primary-500">
      ¿Ahora no los tenés a mano? Podés salir tranquilo y subirlos más tarde desde{' '}
      <Link
        to={documentsLink(participantId)}
        className="font-bold text-primary-700 underline underline-offset-2 hover:text-primary-900 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        Documentos
      </Link>
      .
    </p>
  );
}

// -------------------------------------------------
// Individual
// -------------------------------------------------

export function IndividualInscriptionDocuments({ participantId }: { participantId: string }) {
  const titleId = useId();
  const { canUpload, canOpenDocuments } = useDocumentAccess();

  if (!canUpload) {
    return (
      <section aria-labelledby={titleId} className="card p-5 shadow-sm space-y-2 print:hidden">
        <SectionHeader titleId={titleId}>
          La inscripción ya está registrada. Si todavía no están cargados, el DNI (frente y dorso) y la
          ficha médica los sube la delegación.
        </SectionHeader>
      </section>
    );
  }

  return (
    <section aria-labelledby={titleId} className="card p-5 shadow-sm space-y-4 print:hidden">
      <SectionHeader titleId={titleId}>
        La inscripción ya está registrada. Subir los papeles no es obligatorio para terminar, pero la
        carpeta queda incompleta hasta que estén.
      </SectionHeader>
      <ParticipantDocumentsPanel participantId={participantId} />
      <LaterNote canOpenDocuments={canOpenDocuments} participantId={participantId} />
    </section>
  );
}

// -------------------------------------------------
// Plantel: una carga por integrante, desplegable
// -------------------------------------------------

function MemberDocuments({ member }: { member: TeamInscriptionMember }) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const name = `${member.lastName}, ${member.firstName}`;

  return (
    <li className="rounded-2xl border border-primary-200 bg-white">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
      >
        <span className="min-w-0">
          <span className="block font-bold text-primary-900 truncate">{name}</span>
          <span className="block text-xs text-primary-500">DNI {member.dni}</span>
        </span>
        <span className="flex items-center gap-1 shrink-0 text-xs font-bold text-primary-700">
          {open ? 'Cerrar' : 'Cargar papeles'}
          <ChevronDown
            className={cn('w-4 h-4 transition-transform', open && 'rotate-180')}
            aria-hidden="true"
          />
        </span>
      </button>
      {/* Se monta al abrir: 16 integrantes no piden 16 carpetas de entrada. */}
      <div id={panelId} hidden={!open} className="px-4 pb-4">
        {open && <ParticipantDocumentsPanel participantId={member.participantId} contextLabel={`de ${name}`} />}
      </div>
    </li>
  );
}

export function TeamInscriptionDocuments({ members }: { members: TeamInscriptionMember[] }) {
  const titleId = useId();
  const { canUpload, canOpenDocuments } = useDocumentAccess();

  if (members.length === 0) return null;

  if (!canUpload) {
    return (
      <section aria-labelledby={titleId} className="card p-5 shadow-sm space-y-2 print:hidden">
        <SectionHeader titleId={titleId}>
          El plantel ya está inscripto. Si todavía no están cargados, el DNI (frente y dorso) y la ficha
          médica de cada integrante los sube la delegación.
        </SectionHeader>
      </section>
    );
  }

  return (
    <section aria-labelledby={titleId} className="card p-5 shadow-sm space-y-4 print:hidden">
      <SectionHeader titleId={titleId}>
        El plantel ya está inscripto. Cada integrante necesita DNI (frente y dorso) y ficha médica; no es
        obligatorio subirlos ahora. Abrí a cada uno para cargar sus papeles.
      </SectionHeader>
      <ul className="space-y-2">
        {members.map((member) => (
          <MemberDocuments key={member.inscriptionId} member={member} />
        ))}
      </ul>
      <LaterNote canOpenDocuments={canOpenDocuments} />
    </section>
  );
}
