// ===========================================
// Step 3: Review and Confirm Sub-component
// ===========================================
import { Checkbox } from '@/components/ui/checkbox';
import { FileCheck2, User, Trophy, CheckCircle2, ArrowLeft } from 'lucide-react';
import type { Discipline, Category } from '@/types';
import type { InscriptionFormData } from './StepPersonalData';
import { formatCategoryRange } from '@/lib/categoryRange';

interface StepReviewProps {
  formData: InscriptionFormData;
  calculatedAge: number | null;
  selectedDiscipline?: Discipline;
  selectedCategory?: Category;
  termsAccepted: boolean;
  setTermsAccepted: (v: boolean) => void;
  isSubmitting: boolean;
  onBack: () => void;
  onSubmit: () => void;
  /** A dónde vuelve el botón de atrás: al paso 2 o, sin él, al paso 1. */
  backLabel?: string;
}

export function StepReview({
  formData,
  calculatedAge,
  selectedDiscipline,
  selectedCategory,
  termsAccepted,
  setTermsAccepted,
  isSubmitting,
  onBack,
  onSubmit,
  backLabel = 'Volver a Disciplina',
}: StepReviewProps) {
  return (
    <div className="card p-6 md:p-8 space-y-6 shadow-md">
      <div className="flex items-center gap-2.5 pb-4 border-b border-primary-100 text-primary-800 font-bold text-lg">
        <FileCheck2 className="w-5 h-5 text-accent-600" />
        <span>Paso 3: Verificación y Confirmación Oficial</span>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Athlete Card */}
        <div className="p-5 rounded-2xl bg-surface border border-primary-100 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-primary-500 uppercase tracking-wider">
            <User className="w-4 h-4 text-primary-700" />
            Ficha del Participante
          </div>
          <div className="text-lg font-bold text-primary-900">
            {formData.lastName}, {formData.firstName}
          </div>
          <div className="text-xs text-primary-700 space-y-1">
            <p><span className="font-semibold">DNI:</span> {formData.dni}</p>
            <p><span className="font-semibold">Sexo:</span> {formData.sex}</p>
            <p><span className="font-semibold">Fecha de Nac.:</span> {formData.birthDate} ({calculatedAge} años)</p>
            <p><span className="font-semibold">Departamento:</span> {formData.department}</p>
            <p><span className="font-semibold">Localidad:</span> {formData.locality}</p>
            {formData.phone && <p><span className="font-semibold">Teléfono:</span> {formData.phone}</p>}
          </div>
        </div>

        {/* Discipline Card */}
        <div className="p-5 rounded-2xl bg-surface border border-primary-100 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-primary-500 uppercase tracking-wider">
            <Trophy className="w-4 h-4 text-primary-700" />
            Inscripción Deportiva
          </div>
          <div className="text-lg font-bold text-primary-900">
            {selectedDiscipline?.name}
          </div>
          <div className="text-xs text-primary-700 space-y-1">
            <p><span className="font-semibold">Categoría:</span> {selectedCategory?.name}</p>
            <p><span className="font-semibold">Rango:</span> {selectedCategory ? formatCategoryRange(selectedCategory) : '—'}</p>
            <p><span className="font-semibold">Modalidad:</span> {selectedDiscipline?.type}</p>
            <p><span className="font-semibold">Sistema de Puntuación:</span> {selectedDiscipline?.resultType}</p>
            <p className="inline-flex items-center gap-1 text-secondary-700 font-bold bg-secondary-50 px-2 py-0.5 rounded-md mt-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Requisitos Cumplidos
            </p>
          </div>
        </div>
      </div>

      {/* Terms and conditions */}
      <div className="p-4 rounded-xl bg-primary-50/70 border border-primary-100 space-y-3">
        <Checkbox
          checked={termsAccepted}
          onCheckedChange={setTermsAccepted}
          labelClassName="text-xs leading-relaxed text-primary-800"
          label="Declaro bajo juramento que los datos ingresados son verídicos y corresponden al participante. Acepto el reglamento general y normativas de los Juegos Evita Formoseños 2026."
        />
      </div>

      <div className="pt-4 flex items-center justify-between border-t border-primary-100">
        <button
          type="button"
          onClick={onBack}
          className="pointer-coarse:min-h-11 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-600 hover:text-primary-900 active:text-primary-950 transition-colors duration-120"
        >
          <ArrowLeft className="w-4 h-4" />
          {backLabel}
        </button>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!termsAccepted || isSubmitting}
          className="pointer-coarse:min-h-11 inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700 active:from-secondary-700 active:to-secondary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-[background-color,box-shadow,transform] duration-120 active:scale-[0.98]"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Registrando Inscripción...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-5 h-5 text-white" />
              Confirmar e Inscribirse
            </>
          )}
        </button>
      </div>
    </div>
  );
}
