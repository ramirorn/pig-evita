// ===========================================
// Step 4: Success Credential Sub-component
// ===========================================
import { CheckCircle2, QrCode, Copy, Download, Printer } from 'lucide-react';
import type { Inscription, Discipline, Category } from '@/types';
import type { InscriptionFormData } from './StepPersonalData';

interface StepSuccessProps {
  createdInscription: Inscription;
  formData: InscriptionFormData;
  selectedDiscipline?: Discipline;
  selectedCategory?: Category;
  onCopyCode: (code: string) => void;
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
  return (
    <div className="max-w-2xl mx-auto animate-scale-in space-y-6">
      {/* Success Banner */}
      <div className="text-center">
        <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-secondary-50 flex items-center justify-center border-4 border-secondary-200 shadow-sm">
          <CheckCircle2 className="w-9 h-9 text-secondary-600" />
        </div>
        <h2 className="text-2xl md:text-3xl font-extrabold text-primary-900 tracking-tight">
          ¡Inscripción Registrada con Éxito!
        </h2>
        <p className="text-primary-600 text-sm mt-1 max-w-md mx-auto">
          Tu solicitud ha sido generada correctamente. Guardá tu credencial oficial con código QR para el control en las sedes.
        </p>
      </div>

      {/* Official Credential Card */}
      <div className="card overflow-hidden border-2 border-primary-800 shadow-xl bg-white">
        {/* Credential Header */}
        <div className="bg-gradient-to-r from-primary-800 via-primary-900 to-primary-800 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/logo-sinfondo.png"
              alt="Juegos Evita Formoseños"
              className="h-12 w-auto object-contain drop-shadow-sm"
            />
            <div>
              <h3 className="font-extrabold text-base tracking-tight leading-tight">
                JUEGOS EVITA FORMOSEÑOS
              </h3>
              <p className="text-[10px] text-accent-400 font-bold uppercase tracking-widest leading-tight">
                Credencial Oficial de Inscripción
              </p>
            </div>
          </div>

          <span className="text-xs font-bold text-amber-900 bg-accent-400 px-3 py-1 rounded-full shadow-xs">
            {createdInscription.status}
          </span>
        </div>

        {/* Credential Body */}
        <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
          {/* QR Code Presentation */}
          <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface border border-primary-100">
            {createdInscription.qrImage ? (
              <img
                src={createdInscription.qrImage}
                alt={`QR ${createdInscription.qrCode}`}
                className="w-48 h-48 rounded-xl shadow-xs border border-primary-100"
              />
            ) : (
              <div className="w-48 h-48 bg-primary-50 rounded-xl flex items-center justify-center">
                <QrCode className="w-16 h-16 text-primary-400" />
              </div>
            )}

            <div className="mt-3 flex items-center gap-2">
              <span className="font-mono text-sm font-extrabold text-primary-900 bg-white px-3 py-1 rounded-lg border border-primary-200">
                {createdInscription.qrCode}
              </span>
              <button
                type="button"
                onClick={() => onCopyCode(createdInscription.qrCode)}
                className="p-1.5 rounded-lg text-primary-500 hover:text-primary-800 hover:bg-primary-100 transition-colors"
                title="Copiar código"
              >
                <Copy className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Participant Details */}
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-[11px] font-bold text-primary-400 uppercase tracking-wider block">
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
                <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider block">
                  Disciplina
                </span>
                <p className="font-bold text-primary-800">
                  {createdInscription.category?.discipline?.name || selectedDiscipline?.name}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider block">
                  Categoría
                </span>
                <p className="font-bold text-primary-800">
                  {createdInscription.category?.name || selectedCategory?.name}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary-100 text-xs">
              <div>
                <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider block">
                  Departamento
                </span>
                <p className="font-medium text-primary-700">
                  {createdInscription.participant?.department || formData.department}
                </p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider block">
                  Localidad
                </span>
                <p className="font-medium text-primary-700">
                  {createdInscription.participant?.locality || formData.locality}
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-primary-100 text-[11px] text-primary-500">
              Fecha: {new Date().toLocaleDateString('es-AR')}
            </div>
          </div>
        </div>

        {/* Actions footer */}
        <div className="p-4 bg-surface border-t border-primary-100 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={onDownloadQr}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-800 hover:bg-primary-900 shadow-sm transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Descargar QR
          </button>
          <button
            type="button"
            onClick={onPrint}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-primary-800 bg-white border border-primary-200 hover:bg-primary-50 transition-all"
          >
            <Printer className="w-3.5 h-3.5" />
            Imprimir Comprobante
          </button>
        </div>
      </div>

      <div className="text-center pt-2">
        <button
          type="button"
          onClick={onReset}
          className="text-xs font-bold text-primary-600 hover:text-primary-900 transition-colors"
        >
          + Inscribir a otro participante
        </button>
      </div>
    </div>
  );
}
