// ===========================================
// RegisterWizard — cuerpo de la pestaña "Nueva Inscripción"
// ===========================================
import { InscriptionStepper } from './InscriptionStepper';
import { StepPersonalData } from './StepPersonalData';
import { StepSportSelection } from './StepSportSelection';
import { StepReview } from './StepReview';
import { StepSuccess } from './StepSuccess';
import type { InscriptionWizard } from './useInscriptionWizard';

/**
 * Decide qué paso se ve y reparte el estado del asistente entre los cuatro
 * componentes de paso. Recibe el `wizard` entero como un solo prop: la página lo
 * crea porque también necesita su `step` para el cambio de pestaña.
 */
export function RegisterWizard({ wizard }: { wizard: InscriptionWizard }) {
  const { step, setStep } = wizard;

  return (
    <div>
      {step < 4 && (
        <div className="mb-8 text-center animate-fade-in">
          <h1 className="text-3xl font-extrabold text-primary-800 tracking-tight mb-2">
            Inscripción a los Juegos Evita
          </h1>
          <p className="text-primary-600 max-w-lg mx-auto text-sm">
            Completá tus datos para obtener tu credencial oficial y participar en las etapas de competencia provincial.
          </p>

          <InscriptionStepper step={step} />
        </div>
      )}

      {/* STEP 1: PERSONAL DATA */}
      {step === 1 && (
        <StepPersonalData
          formData={wizard.formData}
          setFormData={wizard.setFormData}
          calculatedAge={wizard.calculatedAge}
          onNext={wizard.handleNextToSport}
        />
      )}

      {/* STEP 2: SPORTS & CATEGORY */}
      {step === 2 && (
        <StepSportSelection
          formData={wizard.formData}
          setFormData={wizard.setFormData}
          disciplines={wizard.disciplines}
          availableCategories={wizard.availableCategories}
          selectedCategory={wizard.selectedCategory}
          categoryCompatibility={wizard.categoryCompatibility}
          calculatedAge={wizard.calculatedAge}
          loadingDisciplines={wizard.loadingDisciplines}
          loadingCategories={wizard.loadingCategories}
          onBack={() => setStep(1)}
          onNext={wizard.handleNextToReview}
        />
      )}

      {/* STEP 3: REVIEW & CONFIRM */}
      {step === 3 && (
        <StepReview
          formData={wizard.formData}
          calculatedAge={wizard.calculatedAge}
          selectedDiscipline={wizard.selectedDiscipline}
          selectedCategory={wizard.selectedCategory}
          termsAccepted={wizard.termsAccepted}
          setTermsAccepted={wizard.setTermsAccepted}
          isSubmitting={wizard.isSubmitting}
          onBack={() => setStep(2)}
          onSubmit={wizard.handleSubmitInscription}
        />
      )}

      {/* STEP 4: SUCCESS CREDENTIAL */}
      {step === 4 && wizard.createdInscription && (
        <StepSuccess
          createdInscription={wizard.createdInscription}
          formData={wizard.formData}
          selectedDiscipline={wizard.selectedDiscipline}
          selectedCategory={wizard.selectedCategory}
          onCopyCode={wizard.handleCopyCode}
          onDownloadQr={wizard.handleDownloadQr}
          onPrint={wizard.handlePrint}
          onReset={wizard.handleResetForm}
        />
      )}
    </div>
  );
}
