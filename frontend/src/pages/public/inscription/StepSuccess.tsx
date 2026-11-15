// ===========================================
// Step 4: Success Credential Sub-component
// ===========================================
import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, QrCode, Copy, Check, Download, Printer } from 'lucide-react';
import { InscriptionStatusBadge } from '@/components/shared/InscriptionStatusBadge';
import type { Inscription, Discipline, Category } from '@/types';
import type { InscriptionFormData } from './StepPersonalData';
import { IndividualInscriptionDocuments } from '@/components/documents/InscriptionDocuments';

interface StepSuccessProps {
  createdInscription: Inscription;
  formData: InscriptionFormData;
  selectedDiscipline?: Discipline;
  selectedCategory?: Category;
  /** Devuelve si realmente se copió; el aviso al usuario lo da quien copia. */
  onCopyCode: (code: string) => void | Promise<boolean>;
  onDownloadQr: () => void;
  onPrint: () => void;
  onReset: () => void;
}

export function StepSuccess({
  createdInscription,
  formData,
  selectedDiscipline,
  selectedCategory,
  onCopyCode,
  onDownloadQr,
  onPrint,
  onReset,
}: StepSuccessProps) {
  const [copiado, setCopiado] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // Al llegar a este paso el foco pasa al título: quien usa lector de pantalla
  // escucha la confirmación y no queda parado sobre un botón que ya no existe.
  useEffect(() => {
    tituloRef.current?.focus();
  }, []);

  const copiar = async () => {
    const resultado = await onCopyCode(createdInscription.qrCode);
    // Sólo se confirma si la copia salió bien: un tilde sobre un portapapeles
    // vacío sería peor que no decir nada.
    if (resultado === false) return;
    setCopiado(true);
    window.setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <div className="max-w-2xl mx-auto animate-scale-in space-y-6">
      {/* Success Banner */}
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-success-50 flex items-center justify-center border-4 border-success-200 shadow-sm">
          <CheckCircle2 className="w-9 h-9 text-success-700" aria-hidden="true" />
        </div>
        <h2 className="type-h1 text-primary-900" tabIndex={-1} ref={tituloRef}>
          Tu inscripción quedó registrada
        </h2>
        <p className="text-primary-700 text-sm mt-2 max-w-md mx-auto">
          Guardá tu código: con él consultás el estado cuando quieras, y la credencial con QR es lo que se controla en las sedes.
        </p>
      </div>

      {/* El código de seguimiento, lo primero que se ve y se puede copiar. */}
      <section aria-labelledby="codigo-seguimiento" className="card border-2 border-primary-800 bg-white p-5 text-center">
        <h3 id="codigo-seguimiento" className="text-sm font-bold text-primary-700">
          Tu código de seguimiento
        </h3>
        <p className="mt-2 select-all break-all font-mono text-2xl font-extrabold tracking-wide text-primary-900 sm:text-3xl">
          {createdInscription.qrCode}
        </p>
        <button
          type="button"
          onClick={() => void copiar()}
          className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-800 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors duration-120 hover:bg-primary-900 active:bg-primary-950"
        >
          {copiado ? (
            <>
              <Check className="w-4 h-4" aria-hidden="true" /> Código copiado
            </>
          ) : (
            <>
              <Copy className="w-4 h-4" aria-hidden="true" /> Copiar código
            </>
          )}
        </button>
        <span role="status" className="sr-only">
          {copiado ? 'Código copiado al portapapeles' : ''}
        </span>
      </section>

      <section aria-labelledby="que-sigue" className="card bg-white p-5">
        <h3 id="que-sigue" className="type-h3 mb-3 text-primary-900">
          Qué pasa ahora
        </h3>
        <ol className="space-y-3 text-sm text-primary-800">
          <li className="flex gap-3">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold tabular-nums">1</span>
            <span>Los delegados zonales revisan tu solicitud. Hoy figura como <InscriptionStatusBadge status={createdInscription.status} className="align-middle" />.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold tabular-nums">2</span>
            <span>Cuando quieras ver cómo va, entrá a <strong>Inscripción</strong> y elegí <strong>Consultar Estado por QR</strong>; pegá tu código.</span>
          </li>
          <li className="flex gap-3">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold tabular-nums">3</span>
            <span>Descargá o imprimí tu credencial (abajo) y llevala el día de la competencia.</span>
          </li>
        </ol>
      </section>

      {/* Official Credential Card */}
      <div className="card overflow-hidden border-2 border-primary-800 shadow-xl bg-white">
        {/* Credential Header */}
        <div className="bg-gradient-to-r from-primary-800 via-primary-900 to-primary-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-sinfondo.png"
              alt="Juegos Evita Formoseños"
              width={48}
              height={48}
              decoding="async"
              className="h-12 w-auto object-contain drop-shadow-sm"
            />
            <div>
              <h3 className="font-extrabold text-base tracking-tight leading-tight">
                JUEGOS EVITA FORMOSEÑOS
              </h3>
              <p className="text-xs text-accent-400 font-bold uppercase tracking-widest leading-tight">
                Credencial Oficial de Inscripción
              </p>
            </div>
          </div>

          <InscriptionStatusBadge status={createdInscription.status} />
        </div>

        {/* Credential Body */}
        <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
          {/* QR Code Presentation */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface border border-primary-100">
            {createdInscription.qrImage ? (
              <img
                src={createdInscription.qrImage}
                alt={`Código QR de la inscripción ${createdInscription.qrCode}`}
                width={192}
                height={192}
                decoding="async"
                className="w-48 h-48 rounded-xl shadow-xs border border-primary-100"
              />
            ) : (
              <div className="w-48 h-48 bg-primary-50 rounded-xl flex items-center justify-center">
                <QrCode className="w-16 h-16 text-primary-500" aria-hidden="true" />
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <span className="font-mono text-sm font-extrabold text-primary-900 bg-white px-3 py-1 rounded-lg border border-primary-200">
                {createdInscription.qrCode}
              </span>
                          </div>
          </div>

          {/* Participant Details */}
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs font-bold text-primary-600 uppercase tracking-wider block">
                Participante
              </span>
              <p className="font-extrabold text-lg text-primary-900 leading-tight">
                {createdInscription.participant?.lastName}, {createdInscription.participant?.firstName}
              </p>
              <p className="text-xs text-primary-600 font-medium">
                DNI: {createdInscription.participant?.dni}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary-100 text-xs">
              <div>
                <span className="text-xs font-bold text-primary-600 uppercase tracking-wider block">
                  Disciplina
                </span>
                <p className="font-bold text-primary-800">
                  {createdInscription.category?.discipline?.name || selectedDiscipline?.name}
                </p>
              </div>
              <div>
                <span className="text-xs font-bold text-primary-600 uppercase tracking-wider block">
                  Categoría
                </span>
                <p className="font-bold text-primary-800">
                  {createdInscription.category?.name || selectedCategory?.name}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary-100 text-xs">
              <div>
                <span className="text-xs font-bold text-primary-600 uppercase tracking-wider block">
                  Departamento
                </span>
                <p className="font-medium text-primary-700">
                  {createdInscription.participant?.department || formData.department}
                </p>
              </div>
              <div>
                <span className="text-xs font-bold text-primary-600 uppercase tracking-wider block">
                  Localidad
                </span>
                <p className="font-medium text-primary-700">
                  {createdInscription.participant?.locality || formData.locality}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-primary-100 text-xs text-primary-600">
              Fecha: {new Date().toLocaleDateString('es-AR')}
            </div>
          </div>
        </div>

        {/* Actions footer */}
        <div className="p-4 bg-surface border-t border-primary-100 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onDownloadQr}
            className="pointer-coarse:min-h-11 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-800 hover:bg-primary-900 active:bg-primary-950 shadow-sm transition-[background-color,border-color,box-shadow,color] duration-120"
          >
            <Download className="w-3.5 h-3.5" aria-hidden="true" />
            Descargar QR
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="pointer-coarse:min-h-11 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-primary-800 bg-white border border-primary-200 hover:bg-primary-50 active:bg-primary-100 transition-[background-color,border-color,box-shadow,color] duration-120"
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            Imprimir Comprobante
          </button>
        </div>
      </div>

      {/* Papeles: opcionales. La inscripción ya existe; acá sólo se avisa qué falta. */}
      {createdInscription.participantId && (
        <IndividualInscriptionDocuments participantId={createdInscription.participantId} />
      )}

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onReset}
          className="pointer-coarse:min-h-11 text-xs font-bold text-primary-600 hover:text-primary-900 active:text-primary-950 transition-colors duration-120"
        >
          Inscribir a otro participante
        </button>
      </div>
    </div>
  );
}
