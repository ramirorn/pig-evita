// ===========================================
// ParticipantDocumentsPanel — los papeles de UN participante
// ===========================================
//
// Junta la carpeta del servidor (`useParticipantDocuments`) con un uploader
// por cada papel protagonista (DNI frente, DNI dorso, ficha médica) y un
// selector "Otro documento" para el resto del enum. Lo usan la pantalla de
// Documentos y el último paso de las dos inscripciones.
import { useId, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { DocumentUploader, type DocumentUploadRequest } from '@/components/shared/DocumentUploader';
import { useParticipantDocuments, useUploadDocument } from '@/hooks/useDocuments';
import {
  DOCUMENT_TYPE_HINTS,
  DOCUMENT_TYPE_LABELS,
  FEATURED_DOCUMENT_TYPES,
  SECONDARY_DOCUMENT_TYPES,
  currentDocumentsByType,
  describeMissing,
  isDocumentType,
  missingFeaturedTypes,
} from '@/lib/documents/documentRules';
import { DocumentType } from '@/types';

interface ParticipantDocumentsPanelProps {
  participantId: string;
  /** "de Pérez, Juan": desambigua los uploaders cuando hay varios en pantalla. */
  contextLabel?: string;
  /** Mostrar el selector "Otro documento". */
  showSecondary?: boolean;
}

const CLASE_SELECT =
  'w-full px-3 py-2 rounded-xl border border-primary-200 bg-white text-primary-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 text-sm font-medium';

export function ParticipantDocumentsPanel({
  participantId,
  contextLabel,
  showSecondary = true,
}: ParticipantDocumentsPanelProps) {
  const selectId = useId();
  const { data, isLoading, isError } = useParticipantDocuments(participantId);
  const upload = useUploadDocument();
  const [otherType, setOtherType] = useState<DocumentType>(
    SECONDARY_DOCUMENT_TYPES[0] ?? DocumentType.OTRO,
  );

  const documents = useMemo(() => data ?? [], [data]);
  const current = useMemo(() => currentDocumentsByType(documents), [documents]);
  const missing = useMemo(() => missingFeaturedTypes(documents), [documents]);

  const uploadAs = (type: DocumentType) => (file: File, request: DocumentUploadRequest) =>
    upload.mutateAsync({ participantId, type, file, ...request });

  const missingText = describeMissing(missing);

  return (
    <div className="space-y-4">
      <p role="status" aria-live="polite" className="text-sm">
        {isLoading ? (
          <span className="inline-flex items-center gap-2 text-primary-500">
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            Revisando qué papeles ya están cargados…
          </span>
        ) : isError ? (
          <span className="inline-flex items-start gap-2 text-primary-600">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" aria-hidden="true" />
            No pudimos ver qué papeles ya están cargados. Igual podés subirlos.
          </span>
        ) : missingText ? (
          <span className="inline-flex items-start gap-2 font-medium text-amber-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            {missingText}
          </span>
        ) : (
          <span className="inline-flex items-center gap-2 font-medium text-secondary-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            Tiene el DNI y la ficha médica cargados.
          </span>
        )}
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {FEATURED_DOCUMENT_TYPES.map((type) => (
          <DocumentUploader
            key={type}
            title={DOCUMENT_TYPE_LABELS[type]}
            hint={DOCUMENT_TYPE_HINTS[type]}
            contextLabel={contextLabel}
            current={current.get(type) ?? null}
            onUpload={uploadAs(type)}
          />
        ))}
      </div>

      {showSecondary && SECONDARY_DOCUMENT_TYPES.length > 0 && (
        <details className="group rounded-2xl border border-primary-100 bg-surface p-3">
          <summary className="cursor-pointer select-none text-sm font-bold text-primary-700 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            Otro documento
          </summary>
          <div className="mt-3 space-y-3">
            <div>
              <label
                htmlFor={selectId}
                className="block text-[11px] font-bold text-primary-700 uppercase tracking-wider mb-1"
              >
                Tipo de documento
              </label>
              <select
                id={selectId}
                value={otherType}
                onChange={(event) => {
                  if (isDocumentType(event.target.value)) setOtherType(event.target.value);
                }}
                className={CLASE_SELECT}
              >
                {SECONDARY_DOCUMENT_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {DOCUMENT_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </div>
            {/* `key`: al cambiar de tipo se descarta lo elegido para el anterior. */}
            <DocumentUploader
              key={otherType}
              title={DOCUMENT_TYPE_LABELS[otherType]}
              hint={DOCUMENT_TYPE_HINTS[otherType]}
              contextLabel={contextLabel}
              current={current.get(otherType) ?? null}
              onUpload={uploadAs(otherType)}
            />
          </div>
        </details>
      )}
    </div>
  );
}
