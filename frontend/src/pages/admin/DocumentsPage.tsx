// ===========================================
// Documents Admin Page
// ===========================================
//
// El backend expone los documentos **por participante**
// (`GET /documents/participant/:id`): no hay listado global ni conteos
// agregados. Por eso la pantalla arranca eligiendo a quién, y las cifras que
// muestra son las de esa carpeta, calculadas con los documentos reales. La
// versión anterior tenía tres filas y tres cifras inventadas; un dato que el
// sistema no tiene no se dibuja.
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CheckCircle, Clock, Eye, FileText, Loader2, Search, UserRound, X, XCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { PageHeader } from '@/components/shared/PageHeader';
import { EmptyState } from '@/components/shared/EmptyState';
import { ParticipantDocumentsPanel } from '@/components/documents/ParticipantDocumentsPanel';
import { usePermisos } from '@/hooks/usePermisos';
import { useDebounce } from '@/hooks/useDebounce';
import { useParticipant, useParticipants } from '@/hooks/useParticipants';
import { useParticipantDocuments } from '@/hooks/useDocuments';
import { DOCUMENT_STATUS_LABELS } from '@/lib/constants';
import {
  DOCUMENT_STATUS_BADGE_CLASSES,
  DOCUMENT_TYPE_LABELS,
  countByStatus,
  currentDocumentsByType,
} from '@/lib/documents/documentRules';
import { cn, formatDate } from '@/lib/utils';
import { DocumentStatus, type DocumentEntity, type Participant } from '@/types';
import { ReviewDocumentDialog } from './documents/ReviewDocumentDialog';

/** Parámetro de URL con el participante elegido (se puede compartir el link). */
const PARTICIPANT_PARAM = 'participante';
const MIN_SEARCH_LENGTH = 2;
const SEARCH_LIMIT = 8;

const STAT_CARDS = [
  {
    status: DocumentStatus.PENDIENTE,
    label: 'Pendientes de revisión',
    icon: Clock,
    circle: 'bg-orange-100',
    iconClass: 'text-orange-600',
  },
  {
    status: DocumentStatus.APROBADO,
    label: 'Aprobados',
    icon: CheckCircle,
    circle: 'bg-green-100',
    iconClass: 'text-green-600',
  },
  {
    status: DocumentStatus.RECHAZADO,
    label: 'Rechazados',
    icon: XCircle,
    circle: 'bg-red-100',
    iconClass: 'text-red-600',
  },
] as const;

function fullName(participant: Pick<Participant, 'firstName' | 'lastName'>): string {
  return `${participant.lastName}, ${participant.firstName}`;
}

export function DocumentsPage() {
  // R22 — validar o rechazar un documento es acto administrativo
  // (`DOCUMENT_REVIEW`): DELEGADO y COORDINADOR ven la pantalla pero no revisan.
  // Subir (`DOCUMENT_UPLOAD`) sí lo puede el DELEGADO; el COORDINADOR sólo mira.
  const { puede } = usePermisos();
  const puedeRevisar = puede('DOCUMENT_REVIEW');
  const puedeSubir = puede('DOCUMENT_UPLOAD');

  const [searchParams, setSearchParams] = useSearchParams();
  const participantId = searchParams.get(PARTICIPANT_PARAM) ?? '';

  const selectParticipant = (id: string | null) => {
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (id) next.set(PARTICIPANT_PARAM, id);
        else next.delete(PARTICIPANT_PARAM);
        return next;
      },
      { replace: false },
    );
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <PageHeader
        title="Documentos"
        description="DNI, ficha médica y demás papeles de cada participante"
        icon={<FileText className="w-5 h-5 text-white" />}
      />

      {participantId ? (
        <ParticipantFolder
          participantId={participantId}
          puedeRevisar={puedeRevisar}
          puedeSubir={puedeSubir}
          onChangeParticipant={() => selectParticipant(null)}
        />
      ) : (
        <ParticipantPicker onSelect={(id) => selectParticipant(id)} />
      )}
    </div>
  );
}

// -------------------------------------------------
// Paso 1: elegir participante
// -------------------------------------------------

function ParticipantPicker({ onSelect }: { onSelect: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const debounced = useDebounce(search.trim());
  const enabled = debounced.length >= MIN_SEARCH_LENGTH;

  const { data, isFetching, isError } = useParticipants(
    { search: debounced, limit: SEARCH_LIMIT },
    { enabled },
  );
  const results = enabled ? (data?.data ?? []) : [];

  return (
    <div className="card">
      <div className="p-4 border-b border-primary-100 space-y-2">
        <label htmlFor="documentos-busqueda" className="block text-sm font-bold text-primary-800">
          ¿De quién son los papeles?
        </label>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400" aria-hidden="true" />
          <Input
            id="documentos-busqueda"
            type="search"
            placeholder="Buscar por DNI o apellido…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            autoComplete="off"
          />
        </div>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {enabled && !isFetching ? `${results.length} resultados` : ''}
      </div>

      {!enabled ? (
        <EmptyState
          icon={<UserRound className="w-10 h-10" />}
          title="Elegí un participante"
          description="Escribí al menos dos letras del apellido o números del DNI para ver su carpeta."
        />
      ) : isFetching && results.length === 0 ? (
        <p className="p-6 flex items-center gap-2 text-sm text-primary-500">
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
          Buscando…
        </p>
      ) : isError ? (
        <EmptyState title="No se pudo buscar" description="Revisá la conexión y probá de nuevo." />
      ) : results.length === 0 ? (
        <EmptyState title="Sin resultados" description={`No hay participantes que coincidan con “${debounced}”.`} />
      ) : (
        <ul className="divide-y divide-primary-100">
          {results.map((participant) => (
            <li key={participant.id}>
              <button
                type="button"
                onClick={() => onSelect(participant.id)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
              >
                <span className="min-w-0">
                  <span className="block font-medium text-primary-900 truncate">{fullName(participant)}</span>
                  <span className="block text-xs text-primary-500">
                    DNI {participant.dni} · {participant.locality}
                  </span>
                </span>
                <span className="text-xs font-bold text-primary-700 shrink-0">Ver carpeta</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// -------------------------------------------------
// Paso 2: la carpeta del participante
// -------------------------------------------------

function ParticipantFolder({
  participantId,
  puedeRevisar,
  puedeSubir,
  onChangeParticipant,
}: {
  participantId: string;
  puedeRevisar: boolean;
  puedeSubir: boolean;
  onChangeParticipant: () => void;
}) {
  const participantQuery = useParticipant(participantId);
  const documentsQuery = useParticipantDocuments(participantId);
  const [reviewing, setReviewing] = useState<DocumentEntity | null>(null);

  const documents = useMemo(() => documentsQuery.data ?? [], [documentsQuery.data]);
  const current = useMemo(
    () =>
      [...currentDocumentsByType(documents).values()].sort((a, b) =>
        a.createdAt < b.createdAt ? 1 : -1,
      ),
    [documents],
  );
  const counts = useMemo(() => countByStatus(documents), [documents]);

  const participant = participantQuery.data;
  const name = participant ? fullName(participant) : 'Participante';

  return (
    <div className="space-y-6">
      <div className="card p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {participantQuery.isLoading ? (
            <p className="text-sm text-primary-500">Cargando participante…</p>
          ) : participant ? (
            <>
              <p className="font-extrabold text-primary-900 truncate">{name}</p>
              <p className="text-xs text-primary-500">
                DNI {participant.dni} · {participant.locality}, {participant.department}
              </p>
            </>
          ) : (
            <p className="text-sm text-primary-600">No encontramos a este participante o no está en tu alcance.</p>
          )}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={onChangeParticipant}>
          <X aria-hidden="true" />
          Elegir otro participante
        </Button>
      </div>

      {/* Cifras de ESTA carpeta, calculadas; sin datos no se dibujan. */}
      {documentsQuery.isSuccess && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" aria-label={`Estado de los documentos de ${name}`}>
          {STAT_CARDS.map(({ status, label, icon: Icon, circle, iconClass }) => (
            <div key={status} className="card p-5 flex items-center gap-4">
              <div className={cn('w-11 h-11 rounded-full flex items-center justify-center shrink-0', circle)}>
                <Icon className={cn('w-5 h-5', iconClass)} aria-hidden="true" />
              </div>
              <div>
                <p className="text-2xl font-bold text-primary-900">{counts[status]}</p>
                <p className="text-sm text-primary-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card">
        <div className="p-4 border-b border-primary-100">
          <h2 className="font-bold text-primary-900">Documentos cargados</h2>
        </div>
        {documentsQuery.isLoading ? (
          <p className="p-6 flex items-center gap-2 text-sm text-primary-500" role="status">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Cargando documentos…
          </p>
        ) : documentsQuery.isError ? (
          <EmptyState title="No se pudieron cargar los documentos" description="Revisá la conexión y recargá la página." />
        ) : current.length === 0 ? (
          <EmptyState
            icon={<FileText className="w-10 h-10" />}
            title="Todavía no hay papeles"
            description={puedeSubir ? 'Subí el DNI y la ficha médica desde acá abajo.' : 'La delegación todavía no subió ningún documento.'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de documento</TableHead>
                <TableHead>Archivo</TableHead>
                <TableHead>Fecha de envío</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[120px] text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {current.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell className="font-medium text-primary-900">
                    {DOCUMENT_TYPE_LABELS[doc.documentType]}
                  </TableCell>
                  <TableCell className="max-w-[16rem] truncate text-primary-600">{doc.originalName}</TableCell>
                  <TableCell>{formatDate(doc.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={DOCUMENT_STATUS_BADGE_CLASSES[doc.status]}>
                      {DOCUMENT_STATUS_LABELS[doc.status]}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {puedeRevisar && (
                      <Button
                        type="button"
                        variant={doc.status === DocumentStatus.PENDIENTE ? 'default' : 'outline'}
                        size="sm"
                        className="gap-2"
                        onClick={() => setReviewing(doc)}
                        aria-label={`Revisar ${DOCUMENT_TYPE_LABELS[doc.documentType]} de ${name}`}
                      >
                        <Eye className="w-4 h-4" aria-hidden="true" />
                        Revisar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {puedeSubir && participant && (
        <section className="card p-4 space-y-3" aria-labelledby="documentos-subir">
          <h2 id="documentos-subir" className="font-bold text-primary-900">
            Subir o reemplazar
          </h2>
          <ParticipantDocumentsPanel participantId={participantId} />
        </section>
      )}

      <ReviewDocumentDialog document={reviewing} participantName={name} onClose={() => setReviewing(null)} />
    </div>
  );
}
