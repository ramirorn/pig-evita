// ===========================================
// Reglas de un uploader — contrato entre el componente y cada dominio
// ===========================================
//
// `DocumentUploader` sabe arrastrar, previsualizar, mostrar progreso, cancelar
// y anunciar errores. Qué archivos sirven, cuánto pueden pesar y qué decir
// cuando algo sale mal es de cada dominio: documentos (DNI, ficha) y fotos de
// sede tienen formatos y mensajes distintos. Este tipo es lo que el componente
// necesita saber de ellos. Módulo puro, sin React.

/** Un error explicado: qué pasó y qué hacer. */
export interface UploadErrorMessage {
  /** Qué pasó, en una línea. */
  title: string;
  /** Qué tiene que hacer la persona ahora. */
  action: string;
  /** Si tiene sentido ofrecer "Reintentar" con el mismo archivo. */
  retryable: boolean;
}

export type UploadPreviewKind = 'image' | 'pdf';

export type UploadValidation =
  | { ok: true; preview: UploadPreviewKind }
  | { ok: false; error: UploadErrorMessage };

/** Lo mínimo de un `File` que hace falta mirar (así se prueba sin DOM). */
export interface UploadFileLike {
  name: string;
  size: number;
  type: string;
}

export interface UploaderRules {
  /** Atributo `accept` del `<input type="file">` de "Elegir archivo". */
  accept: string;
  /** Atributo `accept` del input con `capture` (cámara). */
  cameraAccept: string;
  /** Ayuda corta de formatos y peso ("JPG, PNG o PDF de hasta 5 MB"). */
  formatsHint: string;
  /** ¿Vale la pena mandar este archivo? Cortesía: el backend decide. */
  validate: (file: UploadFileLike) => UploadValidation;
  /** Error de la subida (Axios o lo que sea) → mensaje para la persona. */
  describeError: (error: unknown) => UploadErrorMessage;
  /** Qué se ve cuando la subida terminó bien y todavía no hay versión vigente que mostrar. */
  doneText: string;
  /** Qué se anuncia a lectores de pantalla al terminar ("DNI (frente) subido…"). */
  announceDone: (title: string) => string;
  /**
   * Transformación opcional ANTES de validar y subir (p. ej. achicar una foto
   * enorme). Si falla o no mejora, tiene que devolver el archivo original.
   */
  prepare?: (file: File) => Promise<File>;
}
