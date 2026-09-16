// ===========================================
// Delegate Inscription Page — Admin Panel
// Inscripción de participantes y planteles por delegados
// ===========================================
import { UserPlus } from 'lucide-react';
import { useAuth } from '@/store/auth.store';
import { PageHeader } from '@/components/shared/PageHeader';

import { InscriptionStepper } from '../public/inscription/InscriptionStepper';
import { IndividualBranch } from './inscription/IndividualBranch';
import { StepDisciplineCategory } from './inscription/StepDisciplineCategory';
import { StepRoster } from './inscription/StepRoster';
import { StepTeamReview } from './inscription/StepTeamReview';
import { StepTeamSuccess } from './inscription/StepTeamSuccess';
import { useTeamInscriptionWizard } from './inscription/useTeamInscriptionWizard';

/**
 * El orden del asistente está invertido respecto del anterior: **primero la
 * disciplina y la categoría, después las personas**.
 *
 * El motivo es de negocio, no de prolijidad. La mayoría de las disciplinas del
 * programa son de equipo, y un plantel se carga entero o no sirve de nada.
 * Preguntando el deporte al principio se puede decir de entrada "esto necesita
 * 11 titulares y hasta 5 suplentes", ir contando contra ese número mientras se
 * carga, y —sobre todo— cortar el camino cuando la disciplina todavía no tiene
 * el plantel configurado, antes de que alguien cargue 16 fichas para
 * cosechar un 400.
 *
 * Las disciplinas `INDIVIDUAL` siguen inscribiendo de a una persona: la rama
 * reusa el asistente que ya existía, con el deporte preseleccionado.
 */
export function DelegateInscriptionPage() {
  const { user } = useAuth();
  const wizard = useTeamInscriptionWizard();

  const etiquetas = [
    'Disciplina',
    wizard.esIndividual ? 'Participante' : 'Plantel',
    'Confirmación',
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva Inscripción"
        description={`Inscribí participantes o un plantel completo. Responsable: ${user?.firstName} ${user?.lastName}`}
        icon={<UserPlus className="w-5 h-5 text-white" />}
      />

      {wizard.paso === 1 && (
        <>
          <InscriptionStepper step={1} labels={etiquetas} className="max-w-xl mx-auto" />
          <StepDisciplineCategory
            disciplineId={wizard.disciplineId}
            categoryId={wizard.categoryId}
            disciplines={wizard.disciplines}
            availableCategories={wizard.availableCategories}
            selectedDiscipline={wizard.selectedDiscipline}
            selectedCategory={wizard.selectedCategory}
            plantelRequerido={wizard.plantelRequerido}
            faltaConfigurarPlantel={wizard.faltaConfigurarPlantel}
            loadingDisciplines={wizard.loadingDisciplines}
            loadingCategories={wizard.loadingCategories}
            onSelectDiscipline={wizard.elegirDisciplina}
            onSelectCategory={wizard.elegirCategoria}
            onNext={wizard.confirmarSeleccion}
          />
        </>
      )}

      {wizard.paso > 1 && wizard.esIndividual && (
        <IndividualBranch
          disciplineId={wizard.disciplineId}
          categoryId={wizard.categoryId}
          onVolverASeleccion={wizard.volverASeleccion}
        />
      )}

      {wizard.paso > 1 && !wizard.esIndividual && (
        <>
          {/* El paso 4 son las credenciales emitidas: ahí la barra sobra. */}
          {wizard.paso < 4 && (
            <InscriptionStepper
              step={wizard.paso}
              labels={etiquetas}
              className="max-w-xl mx-auto"
            />
          )}

          {wizard.paso === 2 && <StepRoster wizard={wizard} />}
          {wizard.paso === 3 && <StepTeamReview wizard={wizard} />}
          {wizard.paso === 4 && <StepTeamSuccess wizard={wizard} />}
        </>
      )}
    </div>
  );
}
