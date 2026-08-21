// ===========================================
// InscriptionSteps — los cuatro pasos del asistente de inscripción
// ===========================================
import { StepPersonalData } from './StepPersonalData';
import { StepSportSelection } from './StepSportSelection';
import { StepReview } from './StepReview';
import { StepSuccess } from './StepSuccess';
import type { InscriptionWizard } from './useInscriptionWizard';

/**
 * Decide qué paso se ve y reparte el estado del asistente entre los cuatro
 * componentes de paso. No dibuja nada propio: el encabezado y la barra de
 * progreso los pone quien lo usa, porque la inscripción pública y la del panel
 * de delegados los ubican distinto.
 *
 * Recibe el `wizard` entero como un solo prop: quien lo crea también necesita
 * su `step` para decidir qué encabezado mostrar.
 */
export function InscriptionSteps({ wizard }: { wizard: InscriptionWizard }) {
  const { step, setStep } = wizard;

  return (
    <>
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
    </>
  );
}
