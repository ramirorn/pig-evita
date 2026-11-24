// ===========================================
// ParticipantDocumentsCard — papeles del participante en su ficha (F-41)
// ===========================================
import { useMemo } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, FileText, Loader2 } from 'lucide-react';
import { useParticipantDocuments } from '@/hooks/useDocuments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DOCUMENT_STATUS_LABELS, ROUTES } from '@/lib/constants';
import {
  DOCUMENT_STATUS_BADGE_CLASSES,
  DOCUMENT_TYPE_LABELS,
  currentDocumentsByType,
  describeMissing,
  missingFeaturedTypes,
} from '@/lib/documents/documentRules';

/**
 * Resumen de sólo lectura: qué papel vigente hay de cada tipo y en qué estado.
 *
 * La carga y la revisión viven en Documentos, que ya decide por permiso quién
 * sube y quién revisa (un COORDINADOR ve la ficha pero no sube): acá sólo se
 * enlaza a esa pantalla con el participante elegido.
 */
export function ParticipantDocumentsCard({ participantId }: { participantId: string }) {
  const { data, isLoading, isError } = useParticipantDocuments(participantId);
  const documentos = useMemo(() => data ?? [], [data]);
  const vigentes = useMemo(() => [...currentDocumentsByType(documentos).values()], [documentos]);
  const faltan = describeMissing(missingFeaturedTypes(documentos));

  return (
    <div className="card">
      <div className="p-4 border-b border-primary-100 flex flex-wrap gap-2 justify-between items-center">
        <h2 className="type-h2 text-primary-900">Documentación</h2>
        <Button asChild variant="outline" size="sm">
          <Link to={`${ROUTES.DOCUMENTS}?participante=${encodeURIComponent(participantId)}`}>
            Ver en Documentos
          </Link>
        </Button>
      </div>
      <div className="p-4 text-sm space-y-3">
        {isLoading ? (
          <p className="inline-flex items-center gap-2 text-primary-500">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Cargando documentos…
          </p>
        ) : isError ? (
          <p className="text-primary-600">No pudimos traer los documentos del participante.</p>
        ) : (
          <>
            {faltan && (
              <p className="inline-flex items-start gap-2 font-medium text-warning-800">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                {faltan}
              </p>
            )}
            {vigentes.length === 0 ? (
              <p className="text-primary-500">Todavía no tiene documentos cargados.</p>
            ) : (
              <ul className="divide-y divide-primary-100">
                {vigentes.map((doc) => (
                  <li key={doc.id} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-primary-400 shrink-0" aria-hidden="true" />
                      <span className="text-primary-900 truncate">
                        {DOCUMENT_TYPE_LABELS[doc.documentType]}
                      </span>
                    </span>
                    <Badge variant="outline" className={DOCUMENT_STATUS_BADGE_CLASSES[doc.status]}>
                      {DOCUMENT_STATUS_LABELS[doc.status]}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
