// ===========================================
// DocumentUploader — carga de una foto o PDF (DNI, ficha médica, etc.)
// ===========================================
//
// Presentacional: no sabe de React Query ni de Axios. Quien lo usa le pasa
// `onUpload`, que tiene que devolver una promesa y reportar el progreso.
// Todas las reglas (tamaño, formatos, errores) viven en
// `@/lib/documents/documentRules`, que chequea `npm run check:documents`.
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';
import {
  Camera,
  CheckCircle2,
  FileText,
  FolderOpen,
  Loader2,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DOCUMENT_STATUS_LABELS } from '@/lib/constants';
import {
  DOCUMENT_ACCEPT_ATTRIBUTE,
  DOCUMENT_ERROR_MESSAGES,
  DOCUMENT_FORMATS_HINT,
  DOCUMENT_STATUS_BADGE_CLASSES,
  classifyUploadError,
  isCanceledUpload,
  uploadPercent,
  validateDocumentFile,
  type DocumentErrorKind,
  type DocumentPreviewKind,
} from '@/lib/documents/documentRules';
import { logError } from '@/lib/logger';
import { cn, formatFileSize } from '@/lib/utils';
import { DocumentStatus, type DocumentEntity } from '@/types';

export interface DocumentUploadRequest {
  onProgress: (loaded: number, total: number | undefined) => void;
  signal: AbortSignal;
}

interface DocumentUploaderProps {
  /** Nombre visible del papel ("DNI (frente)"). */
  title: string;
  /** Qué se espera que se vea en la foto. */
  hint?: string;
  /**
   * Contexto para lectores de pantalla cuando hay varios uploaders iguales en
   * la misma pantalla (plantel): "de Pérez, Juan".
   */
  contextLabel?: string;
  /** Documento vigente en el servidor, si ya hay uno. */
  current?: DocumentEntity | null;
  /** Ofrecer "Sacar foto" (cámara trasera) en pantallas táctiles. */
  allowCamera?: boolean;
  onUpload: (file: File, request: DocumentUploadRequest) => Promise<unknown>;
}

type Phase =
  | { name: 'empty' }
  | { name: 'selected' }
  | { name: 'uploading'; percent: number | null }
  | { name: 'done' };

interface Selection {
  file: File;
  preview: DocumentPreviewKind;
  /** `blob:` URL para la miniatura de imágenes; se revoca al reemplazar. */
  objectUrl: string | null;
}

export function DocumentUploader({
  title,
  hint,
  contextLabel,
  current,
  allowCamera = true,
  onUpload,
}: DocumentUploaderProps) {
  const baseId = useId();
  const titleId = `${baseId}-title`;
  const hintId = `${baseId}-hint`;
  const statusId = `${baseId}-status`;

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [selection, setSelection] = useState<Selection | null>(null);
  const [phase, setPhase] = useState<Phase>({ name: 'empty' });
  // `fromServer`: el backend ya rechazó ESTE archivo; si el error no es de
  // reintentar (pesado, tipo), volver a mandarlo no tiene sentido.
  const [error, setError] = useState<{ kind: DocumentErrorKind; fromServer: boolean } | null>(null);
  const [replacing, setReplacing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // Al desmontar: cortar la subida en vuelo y soltar la miniatura.
  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const fullTitle = contextLabel ? `${title} ${contextLabel}` : title;
  const uploading = phase.name === 'uploading';

  function releasePreview() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }

  function acceptFile(file: File | undefined) {
    if (!file || uploading) return;
    const result = validateDocumentFile(file);
    if (!result.ok) {
      // Se descarta el archivo inválido pero se deja la selección anterior
      // (si había una) para no perder una foto buena por un toque de más.
      setError({ kind: result.kind, fromServer: false });
      return;
    }
    releasePreview();
    const objectUrl = result.preview === 'image' ? URL.createObjectURL(file) : null;
    objectUrlRef.current = objectUrl;
    setSelection({ file, preview: result.preview, objectUrl });
    setError(null);
    setPhase({ name: 'selected' });
  }

  function openPicker(kind: 'file' | 'camera') {
    const input = kind === 'camera' ? cameraInputRef.current : fileInputRef.current;
    if (!input) return;
    // Sin esto, elegir dos veces el mismo archivo no dispara `change`.
    input.value = '';
    input.click();
  }

  function clearSelection() {
    releasePreview();
    setSelection(null);
    setError(null);
    setPhase({ name: 'empty' });
  }

  async function startUpload() {
    if (!selection || uploading) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setPhase({ name: 'uploading', percent: 0 });

    try {
      await onUpload(selection.file, {
        signal: controller.signal,
        onProgress: (loaded, total) =>
          setPhase({ name: 'uploading', percent: uploadPercent(loaded, total) }),
      });
      releasePreview();
      setSelection(null);
      setReplacing(false);
      setPhase({ name: 'done' });
    } catch (err) {
      if (isCanceledUpload(err)) {
        setPhase({ name: 'selected' });
        return;
      }
      logError('DocumentUploader.startUpload', err);
      setError({ kind: classifyUploadError(err), fromServer: true });
      setPhase({ name: 'selected' });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
    }
  }

  function cancelUpload() {
    abortRef.current?.abort();
  }

  function handleDrag(event: DragEvent<HTMLDivElement>, active: boolean) {
    event.preventDefault();
    event.stopPropagation();
    if (!uploading) setDragActive(active);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    handleDrag(event, false);
    acceptFile(event.dataTransfer.files[0]);
  }

  // Qué se ve: lo recién elegido manda; si no hay nada elegido, lo que ya está
  // en el servidor (salvo que se haya pedido reemplazarlo).
  const showDropzone = !selection && (replacing || (!current && phase.name !== 'done'));
  const showCurrent = !selection && !showDropzone;

  const errorMessage = error ? DOCUMENT_ERROR_MESSAGES[error.kind] : null;
  const canSend = !(error?.fromServer && errorMessage && !errorMessage.retryable);
  const statusText = uploading
    ? phase.percent === null
      ? `Subiendo ${title}…`
      : `Subiendo ${title}: ${phase.percent}%`
    : phase.name === 'done'
      ? `${title} subido. Queda pendiente de revisión.`
      : selection
        ? `${selection.file.name} listo para subir.`
        : '';

  return (
    <section
      aria-labelledby={titleId}
      aria-describedby={hint ? hintId : undefined}
      className="rounded-2xl border border-primary-200 bg-white p-4 shadow-2xs space-y-3"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 id={titleId} className="text-sm font-extrabold text-primary-900 leading-tight">
            {title}
            {contextLabel && <span className="sr-only"> {contextLabel}</span>}
          </h4>
          {hint && (
            <p id={hintId} className="text-xs text-primary-500 mt-0.5">
              {hint}
            </p>
          )}
        </div>
        {current && (
          <Badge variant="outline" className={cn('shrink-0', DOCUMENT_STATUS_BADGE_CLASSES[current.status])}>
            {DOCUMENT_STATUS_LABELS[current.status]}
          </Badge>
        )}
      </header>

      {/* Inputs reales: los botones de abajo los abren. `capture` fuerza la
          cámara, por eso va en un input aparte y "Elegir archivo" queda siempre. */}
      <input
        ref={fileInputRef}
        type="file"
        accept={DOCUMENT_ACCEPT_ATTRIBUTE}
        className="hidden"
        tabIndex={-1}
        aria-label={`Elegir archivo para ${fullTitle}`}
        onChange={(event) => acceptFile(event.target.files?.[0])}
      />
      {allowCamera && (
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/jpeg,image/png"
          capture="environment"
          className="hidden"
          tabIndex={-1}
          aria-label={`Sacar foto para ${fullTitle}`}
          onChange={(event) => acceptFile(event.target.files?.[0])}
        />
      )}

      {showCurrent && current && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 min-w-0 text-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-secondary-600" aria-hidden="true" />
            <span className="truncate font-medium text-primary-800">{current.originalName}</span>
            <span className="shrink-0 text-xs text-primary-500">{formatFileSize(current.fileSize)}</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={() => setReplacing(true)}>
            <RefreshCw aria-hidden="true" />
            Reemplazar
          </Button>
        </div>
      )}

      {current?.status === DocumentStatus.RECHAZADO && current.rejectionNote && (
        <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-800">
          <span className="font-bold">Motivo del rechazo:</span>{' '}
          <span className="whitespace-pre-wrap">{current.rejectionNote}</span>
        </p>
      )}

      {showCurrent && !current && phase.name === 'done' && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-medium text-secondary-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            Subido. Queda pendiente de revisión.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => setReplacing(true)}>
            <RefreshCw aria-hidden="true" />
            Reemplazar
          </Button>
        </div>
      )}

      {showDropzone && (
        <div
          onDragEnter={(event) => handleDrag(event, true)}
          onDragOver={(event) => handleDrag(event, true)}
          onDragLeave={(event) => handleDrag(event, false)}
          onDrop={handleDrop}
          className={cn(
            'rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors',
            dragActive ? 'border-primary-500 bg-primary-50' : 'border-primary-200 bg-surface',
          )}
        >
          <UploadCloud className="mx-auto w-7 h-7 text-primary-400" aria-hidden="true" />
          <p className="mt-2 text-sm text-primary-700">
            <span className="hidden pointer-fine:inline">Arrastrá el archivo acá o elegilo. </span>
            {DOCUMENT_FORMATS_HINT}.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:justify-center">
            {allowCamera && (
              <Button
                type="button"
                size="sm"
                className="hidden pointer-coarse:inline-flex"
                onClick={() => openPicker('camera')}
              >
                <Camera aria-hidden="true" />
                Sacar foto
              </Button>
            )}
            <Button type="button" variant="outline" size="sm" onClick={() => openPicker('file')}>
              <FolderOpen aria-hidden="true" />
              Elegir archivo
            </Button>
            {replacing && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setReplacing(false)}>
                Cancelar
              </Button>
            )}
          </div>
        </div>
      )}

      {selection && (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            {selection.preview === 'image' && selection.objectUrl ? (
              <img
                src={selection.objectUrl}
                alt={`Vista previa de ${fullTitle}`}
                width={96}
                height={72}
                className="w-24 h-18 shrink-0 rounded-lg border border-primary-100 object-cover bg-primary-50"
              />
            ) : (
              <div
                className="w-24 h-18 shrink-0 rounded-lg border border-primary-100 bg-primary-50 flex items-center justify-center"
                aria-hidden="true"
              >
                <FileText className="w-8 h-8 text-primary-500" />
              </div>
            )}
            <div className="min-w-0 text-sm">
              <p className="truncate font-bold text-primary-900">{selection.file.name}</p>
              <p className="text-xs text-primary-500">
                {selection.preview === 'pdf' ? 'PDF' : 'Imagen'} · {formatFileSize(selection.file.size)}
              </p>
            </div>
          </div>

          {uploading && (
            <div
              role="progressbar"
              aria-label={`Progreso de la subida de ${fullTitle}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={phase.percent ?? undefined}
              className="h-2 w-full overflow-hidden rounded-full bg-primary-100"
            >
              {phase.percent === null ? (
                <div className="h-full w-1/3 rounded-full bg-primary-500 animate-pulse" />
              ) : (
                <div
                  className="h-full rounded-full bg-primary-600 transition-[width] duration-200"
                  style={{ width: `${phase.percent}%` }}
                />
              )}
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {uploading ? (
              <Button type="button" variant="outline" size="sm" onClick={cancelUpload}>
                <X aria-hidden="true" />
                Cancelar subida
              </Button>
            ) : (
              <>
                {canSend && (
                  <Button type="button" size="sm" onClick={() => void startUpload()}>
                    {errorMessage?.retryable ? <RefreshCw aria-hidden="true" /> : <UploadCloud aria-hidden="true" />}
                    {errorMessage?.retryable ? 'Reintentar' : 'Subir'}
                  </Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => openPicker('file')}>
                  <FolderOpen aria-hidden="true" />
                  Elegir otro
                </Button>
                {allowCamera && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="hidden pointer-coarse:inline-flex"
                    onClick={() => openPicker('camera')}
                  >
                    <Camera aria-hidden="true" />
                    Otra foto
                  </Button>
                )}
                <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                  Descartar
                </Button>
              </>
            )}
            {uploading && <Loader2 className="w-4 h-4 self-center animate-spin text-primary-500" aria-hidden="true" />}
          </div>
        </div>
      )}

      {/* Estado para lectores de pantalla (progreso, listo, subido). */}
      <p id={statusId} role="status" aria-live="polite" className="sr-only">
        {statusText}
      </p>

      {/* El error se anuncia apenas aparece y dice qué hacer. */}
      <div role="alert" aria-live="assertive">
        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm">
            <p className="font-bold text-red-800">{errorMessage.title}</p>
            <p className="text-red-700">{errorMessage.action}</p>
          </div>
        )}
      </div>
    </section>
  );
}
