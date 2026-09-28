// ===========================================
// Revisión de un documento (PATCH /documents/:id/review)
// ===========================================
import { useId, useState } from 'react';
import { CheckCircle, ExternalLink, FileText, Loader2, XCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useReviewDocument } from '@/hooks/useDocuments';
import {
  DOCUMENT_TYPE_LABELS,
  REJECTION_NOTE_MAX,
  safeDocumentUrl,
  validateRejectionNote,
} from '@/lib/documents/documentRules';
import { formatDateTime, formatFileSize } from '@/lib/utils';
import { DocumentStatus, type DocumentEntity } from '@/types';

interface ReviewDocumentDialogProps {
  document: DocumentEntity | null;
  participantName: string;
  onClose: () => void;
}

export function ReviewDocumentDialog({ document, participantName, onClose }: ReviewDocumentDialogProps) {
  return (
    <Dialog open={document !== null} onOpenChange={(open) => !open && onClose()}>
      {document && (
        // `key`: cada documento arranca con el formulario limpio.
        <ReviewDocumentContent
          key={document.id}
          document={document}
          participantName={participantName}
          onClose={onClose}
        />
      )}
    </Dialog>
  );
}

function ReviewDocumentContent({
  document,
  participantName,
  onClose,
}: {
  document: DocumentEntity;
  participantName: string;
  onClose: () => void;
}) {
  const noteId = useId();
  const noteErrorId = useId();
  const review = useReviewDocument();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState('');
  const [noteError, setNoteError] = useState<string | null>(null);

  const url = safeDocumentUrl(document.presignedUrl);
  const isImage = document.mimeType.startsWith('image/');
  const label = DOCUMENT_TYPE_LABELS[document.documentType];

  function approve() {
    review.mutate(
      { id: document.id, payload: { status: DocumentStatus.APROBADO } },
      { onSuccess: onClose },
    );
  }

  function reject() {
    const problem = validateRejectionNote(note);
    setNoteError(problem);
    if (problem) return;
    review.mutate(
      { id: document.id, payload: { status: DocumentStatus.RECHAZADO, notes: note.trim() } },
      { onSuccess: onClose },
    );
  }

  return (
    <DialogContent className="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>
          {label} · {participantName}
        </DialogTitle>
        <DialogDescription>
          {document.originalName} · {formatFileSize(document.fileSize)} · enviado el{' '}
          {formatDateTime(document.createdAt)}
        </DialogDescription>
      </DialogHeader>

      <div className="rounded-xl border border-primary-100 bg-surface p-2">
        {url && isImage ? (
          <a href={url} target="_blank" rel="noopener noreferrer" className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500">
            <img
              src={url}
              alt={`${label} de ${participantName}`}
              width={640}
              height={400}
              loading="lazy"
              className="mx-auto max-h-80 w-auto rounded-lg object-contain"
            />
            <span className="sr-only"> (abrir en tamaño completo en otra pestaña)</span>
          </a>
        ) : url ? (
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 py-8 text-sm font-bold text-primary-700 hover:text-primary-900 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
          >
            <FileText className="w-6 h-6" aria-hidden="true" />
            Abrir el PDF en otra pestaña
            <ExternalLink className="w-4 h-4" aria-hidden="true" />
          </a>
        ) : (
          <p className="py-8 text-center text-sm text-primary-500">
            No se pudo generar el enlace para ver el archivo. Cerrá y volvé a abrir la carpeta.
          </p>
        )}
      </div>

      {rejecting && (
        <div className="space-y-1">
          <label htmlFor={noteId} className="block text-sm font-bold text-primary-800">
            Motivo del rechazo
          </label>
          <Textarea
            id={noteId}
            value={note}
            maxLength={REJECTION_NOTE_MAX}
            onChange={(event) => setNote(event.target.value)}
            placeholder="Ej.: la foto está borrosa y no se lee el número."
            aria-invalid={noteError ? true : undefined}
            aria-describedby={noteError ? noteErrorId : undefined}
            autoFocus
          />
          <p id={noteErrorId} role="alert" className="text-xs text-red-700 min-h-4">
            {noteError}
          </p>
        </div>
      )}

      <DialogFooter className="gap-2">
        {rejecting ? (
          <>
            <Button type="button" variant="ghost" onClick={() => setRejecting(false)} disabled={review.isPending}>
              Volver
            </Button>
            <Button type="button" variant="destructive" onClick={reject} disabled={review.isPending}>
              {review.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <XCircle aria-hidden="true" />}
              Confirmar rechazo
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="outline" onClick={() => setRejecting(true)} disabled={review.isPending}>
              <XCircle aria-hidden="true" />
              Rechazar
            </Button>
            <Button type="button" onClick={approve} disabled={review.isPending}>
              {review.isPending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <CheckCircle aria-hidden="true" />}
              Aprobar
            </Button>
          </>
        )}
      </DialogFooter>
    </DialogContent>
  );
}
