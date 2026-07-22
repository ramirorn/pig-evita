// ===========================================
// Inscription Page — Public QR Enrollment
// ===========================================
import { useState } from 'react';
import { Trophy, ClipboardList, CheckCircle2 } from 'lucide-react';
import { Link } from 'react-router';
import { ROUTES } from '@/lib/constants';

type Step = 'form' | 'success';

export function InscriptionPage() {
  const [step, setStep] = useState<Step>('form');

  return (
    <div className="min-h-screen bg-gradient-to-b from-surface to-primary-50">
      {/* Header */}
      <header className="bg-white border-b border-primary-100 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to={ROUTES.HOME} className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
              <Trophy className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-primary-800">Juegos Evita Formosa</span>
          </Link>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {step === 'form' && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-secondary-500 to-secondary-600 flex items-center justify-center shadow-lg">
                <ClipboardList className="w-7 h-7 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-primary-800 mb-2">
                Inscripción a los Juegos Evita
              </h1>
              <p className="text-primary-600 text-sm">
                Completá el formulario para inscribirte en las competencias deportivas.
              </p>
            </div>

            {/* Form placeholder — será implementado completo en Sprint 2 */}
            <div className="card p-6 space-y-6">
              <p className="text-center text-primary-500 text-sm py-8">
                El formulario de inscripción se implementará en la siguiente fase con validación
                completa, selección de disciplina/categoría y generación de código QR.
              </p>

              <button
                onClick={() => setStep('success')}
                className="w-full py-3 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700 shadow-md hover:shadow-lg transition-all"
              >
                Vista previa: Inscripción Exitosa
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="animate-scale-in text-center">
            <div className="card p-8 max-w-md mx-auto">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-secondary-50 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-secondary-500" />
              </div>
              <h2 className="text-xl font-bold text-primary-800 mb-2">
                ¡Inscripción Exitosa!
              </h2>
              <p className="text-primary-600 text-sm mb-6">
                Tu inscripción fue registrada correctamente. El código QR será generado
                cuando el formulario completo esté implementado.
              </p>

              <div className="p-4 rounded-lg bg-surface border border-primary-100 mb-6">
                <p className="text-xs text-primary-500 mb-1">Estado</p>
                <span className="badge bg-amber-100 text-amber-800 border-amber-200">
                  Pendiente de revisión
                </span>
              </div>

              <button
                onClick={() => setStep('form')}
                className="text-sm font-medium text-primary-600 hover:text-primary-800 transition-colors"
              >
                ← Volver al formulario
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
