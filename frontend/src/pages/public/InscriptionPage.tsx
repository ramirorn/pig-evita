// ===========================================
// Inscription Page — Public Enrollment & QR Tracking
// Juegos Evita Formoseños Oficial
// ===========================================
import React, { useState } from 'react';
import { Link } from 'react-router';
import { ClipboardList, Search } from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES } from '@/lib/constants';
import { useInscriptionByQr } from '@/hooks/useInscriptions';

import { RegisterWizard } from './inscription/RegisterWizard';
import { TrackInscription } from './inscription/TrackInscription';
import { useInscriptionWizard } from './inscription/useInscriptionWizard';

type TabMode = 'register' | 'track';

/**
 * Cáscara pública de inscripciones: el encabezado, las dos pestañas y poco más.
 * El asistente vive en `useInscriptionWizard` + `RegisterWizard`; acá queda sólo
 * la consulta por QR, que son tres líneas de estado sobre un componente ya
 * presentacional.
 */
export function InscriptionPage() {
  const [activeTab, setActiveTab] = useState<TabMode>('register');
  const wizard = useInscriptionWizard();

  // Consulta por QR: `searchQr` es lo que se tipea, `submittedQr` lo que dispara
  // la query (recién al enviar, no en cada tecla).
  const [searchQr, setSearchQr] = useState('');
  const [submittedQr, setSubmittedQr] = useState('');
  const { data: trackedInscription, isLoading: loadingTrack, isError: errorTrack } = useInscriptionByQr(submittedQr);

  const handleTrackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = searchQr.trim().toUpperCase();
    if (!clean) {
      toast.error('Ingresá el código QR o ID de inscripción');
      return;
    }
    const formatted = clean.startsWith('EVITA-') ? clean : `EVITA-${clean}`;
    setSubmittedQr(formatted);
  };

  return (
    <div className="min-h-screen bg-surface">
      {/* Header Institucional */}
      <header className="bg-white border-b border-primary-100 shadow-xs sticky top-0 z-30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <Link to={ROUTES.HOME} className="group flex items-center gap-3 rounded-lg active:opacity-80 transition-opacity duration-120">
            <img
              src="/logo-sinfondo.png"
              alt="Juegos Evita Formoseños"
              width={44}
              height={44}
              decoding="async"
              className="h-11 w-auto object-contain transition-transform duration-200 ease-out-soft group-hover:scale-105"
            />
            <div>
              <span className="text-base font-extrabold text-primary-800 tracking-tight block leading-tight">
                Juegos Evita Formoseños
              </span>
              <span className="type-eyebrow text-accent-700 tracking-widest block leading-tight">
                Inscripciones 2026
              </span>
            </div>
          </Link>

          <Link
            to={ROUTES.HOME}
            className="-mr-2 flex items-center gap-1 rounded-lg px-2 py-2 text-sm font-semibold text-primary-600 transition-colors duration-120 hover:text-primary-800 active:text-primary-900 pointer-coarse:min-h-11"
          >
            ← Volver al Inicio
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 md:py-12">
        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex p-1.5 rounded-2xl bg-white border border-primary-200 shadow-xs">
            <button
              type="button"
              onClick={() => {
                setActiveTab('register');
                // Si ya se había emitido una credencial, volver a la pestaña
                // arranca una inscripción nueva en vez de mostrar la anterior.
                if (wizard.step === 4) wizard.setStep(1);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors duration-120 pointer-coarse:min-h-11 ${
                activeTab === 'register'
                  ? 'bg-primary-800 text-white shadow-sm'
                  : 'text-primary-600 hover:text-primary-800 hover:bg-primary-50 active:bg-primary-100'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Nueva Inscripción
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('track')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors duration-120 pointer-coarse:min-h-11 ${
                activeTab === 'track'
                  ? 'bg-primary-800 text-white shadow-sm'
                  : 'text-primary-600 hover:text-primary-800 hover:bg-primary-50 active:bg-primary-100'
              }`}
            >
              <Search className="w-4 h-4" />
              Consultar Estado por QR
            </button>
          </div>
        </div>

        {/* TAB 1: REGISTRATION WIZARD */}
        {activeTab === 'register' && <RegisterWizard wizard={wizard} />}

        {/* TAB 2: QR / DNI TRACKING */}
        {activeTab === 'track' && (
          <TrackInscription
            searchQr={searchQr}
            setSearchQr={setSearchQr}
            submittedQr={submittedQr}
            loadingTrack={loadingTrack}
            errorTrack={errorTrack}
            trackedInscription={trackedInscription}
            onSubmit={handleTrackSubmit}
          />
        )}
      </div>
    </div>
  );
}
