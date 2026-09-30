// ===========================================
// DocumentUploader — carga de una foto o PDF (DNI, ficha médica, foto de sede)
// ===========================================
//
// Presentacional: no sabe de React Query ni de Axios. Quien lo usa le pasa
// `onUpload`, que tiene que devolver una promesa y reportar el progreso.
// Las reglas (tamaño, formatos, errores) llegan por `rules`: por defecto las
// de documentos (`@/lib/documents/documentRules`, `npm run check:documents`);
// la foto de sede pasa las suyas (`@/lib/venues/venueImageRules`,
// `npm run check:venues`). Un solo componente, dos contratos.
import { useEffect, useId, useRef, useState, type DragEvent, type ReactNode } from 'react';
import {
  Camera,
  CheckCircle2,
  FileText,
  FolderOpen,
  ImageOff,
  Loader2,
  RefreshCw,
  UploadCloud,
  X,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DOCUMENT_STATUS_LABELS } from '@/lib/constants';
import {
  DOCUMENT_STATUS_BADGE_CLASSES,
  DOCUMENT_UPLOADER_RULES,
  isCanceledUpload,
  uploadPercent,
} from '@/lib/documents/documentRules';
import type {
  UploadErrorMessage,
  UploadPreviewKind,
  UploaderRules,
} from '@/lib/uploads/uploaderRules';
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
  /**
   * Imagen vigente cuando lo que se carga no es un documento (foto de sede).
   * `src` ya tiene que venir saneada por quien la pasa.
   */
  currentImage?: { src: string; alt: string } | null;
  /** Acciones extra junto a "Reemplazar" sobre lo vigente (p. ej. "Quitar foto"). */
  currentActions?: ReactNode;
  /** Ofrecer "Sacar foto" (cámara trasera) en pantallas táctiles. */
  allowCamera?: boolean;
  /** Formatos, límites y mensajes. Por defecto, los de documentos. */
  rules?: UploaderRules;
  /** Nivel del título según dónde se monte (en un diálogo cuelga de un h2). */
  headingLevel?: 3 | 4;
  onUpload: (file: File, request: DocumentUploadRequest) => Promise<unknown>;
}

type Phase =
  | { name: 'empty' }
  | { name: 'preparing' }
  | { name: 'selected' }
  | { name: 'uploading'; percent: number | null }
  | { name: 'done' };

interface Selection {
  file: File;
  preview: UploadPreviewKind;
  /** `blob:` URL para la miniatura de imágenes; se revoca al reemplazar. */
  objectUrl: string | null;
}

export function DocumentUploader({
  title,
  hint,
  contextLabel,
  current,
  currentImage,
  currentActions,
  allowCamera = true,
  rules = DOCUMENT_UPLOADER_RULES,
  headingLevel = 4,
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
  const [error, setError] = useState<{ message: UploadErrorMessage; fromServer: boolean } | null>(null);
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
  const preparing = phase.name === 'preparing';
  const busy = uploading || preparing;
  const Heading = headingLevel === 3 ? 'h3' : 'h4';

  function releasePreview() {
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = null;
  }

  async function acceptFile(picked: File | undefined) {
    if (!picked || busy) return;
    const previousPhase = phase;

    // Optimización opcional (foto de sede): va ANTES de validar, así una foto
    // de 8 MB que queda en 600 KB no se rechaza por pesada.
    let file = picked;
    if (rules.prepare) {
      setPhase({ name: 'preparing' });
      try {
        file = await rules.prepare(picked);
      } catch {
        file = picked;
      }
    }

    const result = rules.validate(file);
    if (!result.ok) {
      // Se descarta el archivo inválido pero se deja la selección anterior
      // (si había una) para no perder una foto buena por un toque de más.
      setError({ message: result.error, fromServer: false });
      setPhase(previousPhase);
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
      setError({ message: rules.describeError(err), fromServer: true });
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
    if (!busy) setDragActive(active);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    handleDrag(event, false);
    void acceptFile(event.dataTransfer.files[0]);
  }

  // Qué se ve: lo recién elegido manda; si no hay nada elegido, lo que ya está
  // en el servidor (salvo que se haya pedido reemplazarlo).
  const hasCurrent = Boolean(current || currentImage);
  const showDropzone = !selection && (replacing || (!hasCurrent && phase.name !== 'done'));
  const showCurrent = !selection && !showDropzone;

  const errorMessage = error?.message ?? null;
  const canSend = !(error?.fromServer && errorMessage && !errorMessage.retryable);
  const statusText = uploading
    ? phase.percent === null
      ? `Subiendo ${title}…`
      : `Subiendo ${title}: ${phase.percent}%`
    : preparing
      ? `Preparando ${title}…`
      : phase.name === 'done'
        ? rules.announceDone(title)
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
          <Heading id={titleId} className="text-sm font-extrabold text-primary-900 leading-tight">
            {title}
            {contextLabel && <span className="sr-only"> {contextLabel}</span>}
          </Heading>
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
        accept={rules.accept}
        className="hidden"
        tabIndex={-1}
        aria-label={`Elegir archivo para ${fullTitle}`}
        onChange={(event) => void acceptFile(event.target.files?.[0])}
      />
      {allowCamera && (
        <input
          ref={cameraInputRef}
          type="file"
          accept={rules.cameraAccept}
          capture="environment"
          className="hidden"
          tabIndex={-1}
          aria-label={`Sacar foto para ${fullTitle}`}
          onChange={(event) => void acceptFile(event.target.files?.[0])}
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

      {showCurrent && !current && currentImage && (
        <div className="space-y-3">
          <CurrentImage key={currentImage.src} src={currentImage.src} alt={currentImage.alt} />
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <Button type="button" variant="outline" size="sm" onClick={() => setReplacing(true)}>
              <RefreshCw aria-hidden="true" />
              Reemplazar
            </Button>
            {currentActions}
          </div>
        </div>
      )}

      {current?.status === DocumentStatus.RECHAZADO && current.rejectionNote && (
        <p className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-800">
          <span className="font-bold">Motivo del rechazo:</span>{' '}
          <span className="whitespace-pre-wrap">{current.rejectionNote}</span>
        </p>
      )}

      {showCurrent && !hasCurrent && phase.name === 'done' && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-sm font-medium text-secondary-700">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            {rules.doneText}
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
            {rules.formatsHint}.
          </p>
          {preparing ? (
            <p className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-primary-700">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              Preparando la imagen…
            </p>
          ) : (
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
          )}
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
            {preparing ? (
              <p className="inline-flex items-center gap-2 text-sm font-medium text-primary-700">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                Preparando la imagen…
              </p>
            ) : uploading ? (
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

/**
 * Imagen vigente en el servidor. Si no carga (se borró en el medio, sin red),
 * se muestra un aviso en su lugar y no el ícono de imagen rota del navegador.
 */
function CurrentImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="flex aspect-video w-full max-w-sm flex-col items-center justify-center gap-1 rounded-xl border border-primary-100 bg-primary-50 text-center text-xs text-primary-600">
        <ImageOff className="w-6 h-6 text-primary-500" aria-hidden="true" />
        No se pudo mostrar la imagen actual.
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      width={384}
      height={216}
      decoding="async"
      onError={() => setFailed(true)}
      className="aspect-video w-full max-w-sm rounded-xl border border-primary-100 bg-primary-50 object-cover"
    />
  );
}
