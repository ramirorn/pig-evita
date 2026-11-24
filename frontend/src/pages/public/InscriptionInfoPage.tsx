// ===========================================
// Inscription Info Page — Public
// Reemplaza el formulario de auto-inscripción
// ===========================================
import { useState } from 'react';
import { Link } from 'react-router';
import { Info, Search, UserCheck, Shield, QrCode } from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES } from '@/lib/constants';
import { useInscriptionByQr } from '@/hooks/useInscriptions';
import { TrackInscription } from './inscription/TrackInscription';

export function InscriptionInfoPage() {
  // QR Tracking State
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
        {/* Info Section */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary-50 flex items-center justify-center border-4 border-primary-200 shadow-sm">
            <Info className="w-8 h-8 text-primary-600" />
          </div>
          <h1 className="type-h1 text-primary-800 mb-3">
            Inscripciones a los Juegos Evita
          </h1>
          <p className="text-primary-600 max-w-lg mx-auto text-sm leading-relaxed">
            Las inscripciones a los Juegos Evita Formoseños son realizadas exclusivamente por los
            <strong> delegados autorizados</strong> de cada institución o zona deportiva.
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
          <div className="card p-6 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-primary-50 flex items-center justify-center">
              <UserCheck className="w-6 h-6 text-primary-700" />
            </div>
            <h3 className="type-h3 text-primary-800">Contactá a tu Delegado</h3>
            <p className="text-sm text-primary-600 leading-relaxed">
              Comunicáte con el delegado o profesor responsable de tu institución educativa o club deportivo para solicitar tu inscripción.
            </p>
          </div>

          <div className="card p-6 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-secondary-50 flex items-center justify-center">
              <Shield className="w-6 h-6 text-secondary-700" />
            </div>
            <h3 className="type-h3 text-primary-800">Inscripción Oficial</h3>
            <p className="text-sm text-primary-600 leading-relaxed">
              Tu delegado realizará la inscripción a través del sistema oficial, asegurando que tus datos estén correctos y validados.
            </p>
          </div>

          <div className="card p-6 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-xl bg-accent-50 flex items-center justify-center">
              <QrCode className="w-6 h-6 text-accent-700" />
            </div>
            <h3 className="type-h3 text-primary-800">Verificá con tu QR</h3>
            <p className="text-sm text-primary-600 leading-relaxed">
              Una vez inscripto, recibirás un código QR. Usalo acá abajo para verificar el estado de tu inscripción en cualquier momento.
            </p>
          </div>
        </div>

        {/* Delegate Login CTA */}
        <div className="card p-6 bg-primary-50/50 border-primary-200 text-center mb-10">
          <p className="text-sm text-primary-700 font-medium mb-3">
            ¿Sos delegado o entrenador? Accedé al panel administrativo para inscribir a tus participantes.
          </p>
          <Link
            to={ROUTES.LOGIN}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary-800 hover:bg-primary-900 active:bg-primary-950 shadow-md hover:shadow-lg transition-[background-color,box-shadow] duration-120 pointer-coarse:min-h-11"
          >
            Iniciar Sesión como Delegado
          </Link>
        </div>

        {/* Divider */}
        <div className="flex items-center gap-4 mb-8">
          <div className="flex-1 h-px bg-primary-200" />
          <span className="text-xs font-bold text-primary-500 uppercase tracking-wider flex items-center gap-2">
            <Search className="w-4 h-4" />
            Consultar Estado de Inscripción
          </span>
          <div className="flex-1 h-px bg-primary-200" />
        </div>

        {/* QR Tracking */}
        <TrackInscription
          searchQr={searchQr}
          setSearchQr={setSearchQr}
          submittedQr={submittedQr}
          loadingTrack={loadingTrack}
          errorTrack={errorTrack}
          trackedInscription={trackedInscription}
          onSubmit={handleTrackSubmit}
          headingLevel="h2"
        />
      </div>
    </div>
  );
}
