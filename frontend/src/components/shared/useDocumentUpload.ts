// ===========================================
// useDocumentUpload — estado y ciclo de vida de una subida de archivo
// ===========================================
//
// Lo que el uploader *hace*: preparar, validar, previsualizar, subir con
// progreso, cancelar y recordar el error. `DocumentUploader` queda con el
// dibujo. Vive junto al componente (y no en `@/hooks/`) porque es parte de él:
// tampoco hace HTTP, recibe `onUpload` igual que el componente.
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { isCanceledUpload, uploadPercent } from '@/lib/documents/documentRules';
import type { UploadErrorMessage, UploadPreviewKind, UploaderRules } from '@/lib/uploads/uploaderRules';
import { logError } from '@/lib/logger';

export interface DocumentUploadRequest {
  onProgress: (loaded: number, total: number | undefined) => void;
  signal: AbortSignal;
}

export type UploadPhase =
  | { name: 'empty' }
  | { name: 'preparing' }
  | { name: 'selected' }
  | { name: 'uploading'; percent: number | null }
  | { name: 'done' };

export interface UploadSelection {
  file: File;
  preview: UploadPreviewKind;
  /** `blob:` URL para la miniatura de imágenes; se revoca al reemplazar. */
  objectUrl: string | null;
}

interface UseDocumentUploadOptions {
  rules: UploaderRules;
  onUpload: (file: File, request: DocumentUploadRequest) => Promise<unknown>;
}

export function useDocumentUpload({ rules, onUpload }: UseDocumentUploadOptions) {
  const abortRef = useRef<AbortController | null>(null);
  const objectUrlRef = useRef<string | null>(null);

  const [selection, setSelection] = useState<UploadSelection | null>(null);
  const [phase, setPhase] = useState<UploadPhase>({ name: 'empty' });
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

  const uploading = phase.name === 'uploading';
  const preparing = phase.name === 'preparing';
  const busy = uploading || preparing;

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
        onProgress: (loaded, total) => setPhase({ name: 'uploading', percent: uploadPercent(loaded, total) }),
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

  return {
    selection,
    phase,
    error,
    replacing,
    setReplacing,
    dragActive,
    uploading,
    preparing,
    busy,
    acceptFile,
    clearSelection,
    startUpload,
    cancelUpload,
    handleDrag,
    handleDrop,
  };
}
