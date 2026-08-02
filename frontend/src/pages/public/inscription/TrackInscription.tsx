// ===========================================
// Track Inscription Sub-component (QR / DNI Search)
// ===========================================
import React from 'react';
import { QrCode, Search, XCircle, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { InscriptionStatus, type Inscription } from '@/types';

interface TrackInscriptionProps {
  searchQr: string;
  setSearchQr: (v: string) => void;
  submittedQr: string;
  loadingTrack: boolean;
  errorTrack: boolean;
  trackedInscription?: Inscription;
  onSubmit: (e: React.FormEvent) => void;
}

export function TrackInscription({
  searchQr,
  setSearchQr,
  submittedQr,
  loadingTrack,
  errorTrack,
  trackedInscription,
  onSubmit,
}: TrackInscriptionProps) {
  return (
    <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
      <div className="text-center mb-6">
        <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-gradient-to-br from-primary-800 to-primary-600 flex items-center justify-center shadow-md">
          <QrCode className="w-7 h-7 text-accent-500" />
        </div>
        <h2 className="text-2xl font-extrabold text-primary-800 tracking-tight mb-1">
          Consultar Estado de Inscripción
        </h2>
        <p className="text-primary-600 text-xs">
          Ingresá tu código QR oficial (ej. <span className="font-mono font-semibold">EVITA-A1B2C3D4</span>) para verificar el estado de tu trámite.
        </p>
      </div>

      {/* Search Input */}
      <form onSubmit={onSubmit} className="card p-4 flex gap-2 shadow-sm">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-primary-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Código QR (ej. EVITA-12345678)"
            value={searchQr}
            onChange={(e) => setSearchQr(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-primary-200 text-primary-900 placeholder:text-primary-300 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 uppercase"
          />
        </div>
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-primary-800 hover:bg-primary-900 text-white font-bold text-xs shadow-xs transition-all"
        >
          Buscar
        </button>
      </form>

      {/* Loading */}
      {loadingTrack && (
        <div className="card p-8 text-center text-primary-500 text-xs flex flex-col items-center gap-2">
          <div className="w-6 h-6 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
          Buscando inscripción...
        </div>
      )}

      {/* Error or Not Found */}
      {errorTrack && submittedQr && (
        <div className="p-4 rounded-2xl bg-destructive-50 border border-red-200 text-destructive-700 text-xs flex items-center gap-3">
          <XCircle className="w-5 h-5 text-destructive-500 flex-shrink-0" />
          <div>
            <p className="font-bold">Inscripción no encontrada</p>
            <p className="text-[11px] mt-0.5">
              No se encontró ningún registro para el código <span className="font-mono font-semibold">{submittedQr}</span>. Verificá los caracteres ingresados.
            </p>
          </div>
        </div>
      )}

      {/* Track Result Card */}
      {trackedInscription && (
        <div className="card p-6 border-2 border-primary-100 shadow-lg space-y-4 animate-scale-in">
          <div className="flex items-center justify-between pb-3 border-b border-primary-100">
            <div>
              <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider block">
                Código de Inscripción
              </span>
              <span className="font-mono text-base font-extrabold text-primary-900">
                {trackedInscription.qrCode}
              </span>
            </div>

            <span
              className={`text-xs font-extrabold px-3 py-1 rounded-full border ${
                trackedInscription.status === InscriptionStatus.APROBADA
                  ? 'bg-secondary-50 text-secondary-800 border-secondary-300'
                  : trackedInscription.status === InscriptionStatus.REVISADA
                  ? 'bg-primary-50 text-primary-800 border-primary-300'
                  : trackedInscription.status === InscriptionStatus.RECHAZADA
                  ? 'bg-destructive-50 text-destructive-700 border-red-200'
                  : 'bg-accent-50 text-accent-800 border-accent-300'
              }`}
            >
              {trackedInscription.status}
            </span>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-primary-50">
              <span className="text-primary-500">Participante:</span>
              <span className="font-bold text-primary-900">
                {trackedInscription.participant?.lastName}, {trackedInscription.participant?.firstName}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-primary-50">
              <span className="text-primary-500">DNI:</span>
              <span className="font-mono font-semibold text-primary-800">
                {trackedInscription.participant?.dni}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-primary-50">
              <span className="text-primary-500">Disciplina:</span>
              <span className="font-bold text-primary-800">
                {trackedInscription.category?.discipline?.name}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-primary-50">
              <span className="text-primary-500">Categoría:</span>
              <span className="font-medium text-primary-800">
                {trackedInscription.category?.name}
              </span>
            </div>

            <div className="flex justify-between py-1 border-b border-primary-50">
              <span className="text-primary-500">Departamento:</span>
              <span className="font-medium text-primary-800">
                {trackedInscription.participant?.department}
              </span>
            </div>

            <div className="flex justify-between py-1">
              <span className="text-primary-500">Fecha de Registro:</span>
              <span className="font-medium text-primary-800">
                {new Date(trackedInscription.createdAt).toLocaleDateString('es-AR')}
              </span>
            </div>
          </div>

          {/* Status Notice */}
          {trackedInscription.status === InscriptionStatus.APROBADA && (
            <div className="p-3 rounded-xl bg-secondary-50 border border-secondary-200 text-secondary-800 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-secondary-600 flex-shrink-0" />
              <span>Tu inscripción está aprobada y confirmada para competir.</span>
            </div>
          )}

          {trackedInscription.status === InscriptionStatus.PENDIENTE && (
            <div className="p-3 rounded-xl bg-accent-50 border border-accent-200 text-accent-900 text-xs flex items-center gap-2">
              <Clock className="w-4 h-4 text-accent-600 flex-shrink-0" />
              <span>Tu solicitud está en proceso de revisión por los delegados zonales.</span>
            </div>
          )}

          {trackedInscription.status === InscriptionStatus.RECHAZADA && (
            <div className="p-3 rounded-xl bg-destructive-50 border border-red-200 text-destructive-700 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold">
                <AlertCircle className="w-4 h-4 text-destructive-500" />
                Inscripción Rechazada
              </div>
              {trackedInscription.rejectionNote && (
                <p className="text-[11px] pl-6">Motivo: {trackedInscription.rejectionNote}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
