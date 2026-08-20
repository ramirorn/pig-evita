// ===========================================
// Delegate Inscription Page — Admin Panel
// Inscripción de participantes por delegados
// ===========================================
import React, { useState, useMemo } from 'react';
import { UserPlus, Check } from 'lucide-react';
import { toast } from 'sonner';
import { Sex, type Inscription } from '@/types';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
import { useCreateInscription } from '@/hooks/useInscriptions';
import { useAuth } from '@/store/auth.store';
import { PageHeader } from '@/components/shared/PageHeader';

import { StepPersonalData, type InscriptionFormData } from '../public/inscription/StepPersonalData';
import { StepSportSelection } from '../public/inscription/StepSportSelection';
import { StepReview } from '../public/inscription/StepReview';
import { StepSuccess } from '../public/inscription/StepSuccess';
import { logError } from '@/lib/logger';

type WizardStep = 1 | 2 | 3 | 4;

export function DelegateInscriptionPage() {
  const { user } = useAuth();
  const [step, setStep] = useState<WizardStep>(1);

  // Form State
  const [formData, setFormData] = useState<InscriptionFormData>({
    dni: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    sex: Sex.MASCULINO,
    phone: '',
    email: '',
    department: 'Formosa',
    locality: '',
    address: '',
    disciplineId: '',
    categoryId: '',
  });

  const [termsAccepted, setTermsAccepted] = useState(false);
  const [createdInscription, setCreatedInscription] = useState<Inscription | null>(null);

  // Queries & Mutations
  const { data: disciplinesData, isLoading: loadingDisciplines } = useDisciplines({ limit: 100 });
  const { data: categoriesData, isLoading: loadingCategories } = useCategories({ limit: 100 });
  const createMutation = useCreateInscription();

  // Calculate age
  const calculatedAge = useMemo(() => {
    if (!formData.birthDate) return null;
    const birth = new Date(formData.birthDate);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  }, [formData.birthDate]);

  // Filter categories by selected discipline
  const availableCategories = useMemo(() => {
    if (!formData.disciplineId || !categoriesData?.data) return [];
    return categoriesData.data.filter(
      (cat) => cat.disciplineId === formData.disciplineId && cat.isActive,
    );
  }, [formData.disciplineId, categoriesData]);

  // Selected entities for review
  const selectedDiscipline = useMemo(() => {
    return disciplinesData?.data.find((d) => d.id === formData.disciplineId);
  }, [formData.disciplineId, disciplinesData]);

  const selectedCategory = useMemo(() => {
    return categoriesData?.data.find((c) => c.id === formData.categoryId);
  }, [formData.categoryId, categoriesData]);

  // Category compatibility
  const categoryCompatibility = useMemo(() => {
    if (!selectedCategory || calculatedAge === null) return { valid: true, message: '' };

    if (calculatedAge < selectedCategory.minAge || calculatedAge > selectedCategory.maxAge) {
      return {
        valid: false,
        message: `La edad del participante (${calculatedAge} años) no está dentro del rango permitido (${selectedCategory.minAge} a ${selectedCategory.maxAge} años).`,
      };
    }

    if (selectedCategory.sex !== Sex.MIXTO && selectedCategory.sex !== formData.sex) {
      return {
        valid: false,
        message: `Esta categoría está designada para ${selectedCategory.sex === Sex.FEMENINO ? 'Femenino' : 'Masculino'}.`,
      };
    }

    return { valid: true, message: '¡Cumple todos los requisitos de edad y categoría!' };
  }, [selectedCategory, calculatedAge, formData.sex]);

  // Handlers
  const handleNextToSport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.dni.trim() || !formData.firstName.trim() || !formData.lastName.trim() || !formData.birthDate || !formData.locality.trim()) {
      toast.error('Por favor completá todos los campos obligatorios');
      return;
    }
    if (!/^\d{7,8}$/.test(formData.dni.trim())) {
      toast.error('El DNI debe tener 7 u 8 dígitos numéricos');
      return;
    }
    setStep(2);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNextToReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.disciplineId) {
      toast.error('Por favor seleccioná una disciplina');
      return;
    }
    if (!formData.categoryId) {
      toast.error('Por favor seleccioná una categoría');
      return;
    }
    if (!categoryCompatibility.valid) {
      toast.error(categoryCompatibility.message || 'La categoría no es compatible con el participante');
      return;
    }
    setStep(3);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmitInscription = async () => {
    if (!termsAccepted) {
      toast.error('Debes aceptar el reglamento y la declaración jurada para continuar');
      return;
    }

    try {
      const response = await createMutation.mutateAsync({
        dni: formData.dni.trim(),
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        birthDate: formData.birthDate,
        sex: formData.sex,
        phone: formData.phone.trim() || undefined,
        email: formData.email.trim() || undefined,
        locality: formData.locality.trim(),
        department: formData.department,
        address: formData.address.trim() || undefined,
        categoryId: formData.categoryId,
      });

      setCreatedInscription(response);
      setStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      logError('DelegateInscriptionPage.handleSubmitInscription', err);
    }
  };

  const handleDownloadQr = () => {
    if (!createdInscription?.qrImage) return;
    const link = document.createElement('a');
    link.href = createdInscription.qrImage;
    link.download = `Credencial-Juegos-Evita-${createdInscription.qrCode}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Código QR descargado correctamente');
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('Código copiado al portapapeles');
  };

  const handlePrint = () => {
    window.print();
  };

  const handleResetForm = () => {
    setFormData({
      dni: '',
      firstName: '',
      lastName: '',
      birthDate: '',
      sex: Sex.MASCULINO,
      phone: '',
      email: '',
      department: 'Formosa',
      locality: '',
      address: '',
      disciplineId: '',
      categoryId: '',
    });
    setTermsAccepted(false);
    setCreatedInscription(null);
    setStep(1);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Nueva Inscripción"
        description={`Inscribí participantes como delegado. Responsable: ${user?.firstName} ${user?.lastName}`}
        icon={<UserPlus className="w-5 h-5 text-white" />}
      />

      {/* Stepper Progress Bar */}
      {step < 4 && (
        <div className="max-w-xl mx-auto">
          <div className="flex items-center justify-between relative">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-primary-100 w-full z-0" />
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 h-1 bg-secondary-500 transition-all duration-300 z-0"
              style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
            />

            {/* Step 1 */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  step >= 1
                    ? 'bg-primary-800 text-white ring-4 ring-primary-50'
                    : 'bg-white border-2 border-primary-200 text-primary-400'
                }`}
              >
                {step > 1 ? <Check className="w-4 h-4 text-accent-400" /> : '1'}
              </div>
              <span className="text-[11px] font-semibold text-primary-700 mt-2">
                Participante
              </span>
            </div>

            {/* Step 2 */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  step >= 2
                    ? 'bg-primary-800 text-white ring-4 ring-primary-50'
                    : 'bg-white border-2 border-primary-200 text-primary-400'
                }`}
              >
                {step > 2 ? <Check className="w-4 h-4 text-accent-400" /> : '2'}
              </div>
              <span className="text-[11px] font-semibold text-primary-700 mt-2">
                Disciplina
              </span>
            </div>

            {/* Step 3 */}
            <div className="relative z-10 flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                  step === 3
                    ? 'bg-primary-800 text-white ring-4 ring-primary-50'
                    : 'bg-white border-2 border-primary-200 text-primary-400'
                }`}
              >
                3
              </div>
              <span className="text-[11px] font-semibold text-primary-700 mt-2">
                Confirmación
              </span>
            </div>
          </div>
        </div>
      )}

      {/* STEP 1: PERSONAL DATA */}
      {step === 1 && (
        <StepPersonalData
          formData={formData}
          setFormData={setFormData}
          calculatedAge={calculatedAge}
          onNext={handleNextToSport}
        />
      )}

      {/* STEP 2: SPORTS & CATEGORY */}
      {step === 2 && (
        <StepSportSelection
          formData={formData}
          setFormData={setFormData}
          disciplines={disciplinesData?.data}
          availableCategories={availableCategories}
          selectedCategory={selectedCategory}
          categoryCompatibility={categoryCompatibility}
          calculatedAge={calculatedAge}
          loadingDisciplines={loadingDisciplines}
          loadingCategories={loadingCategories}
          onBack={() => setStep(1)}
          onNext={handleNextToReview}
        />
      )}

      {/* STEP 3: REVIEW & CONFIRM */}
      {step === 3 && (
        <StepReview
          formData={formData}
          calculatedAge={calculatedAge}
          selectedDiscipline={selectedDiscipline}
          selectedCategory={selectedCategory}
          termsAccepted={termsAccepted}
          setTermsAccepted={setTermsAccepted}
          isSubmitting={createMutation.isPending}
          onBack={() => setStep(2)}
          onSubmit={handleSubmitInscription}
        />
      )}

      {/* STEP 4: SUCCESS CREDENTIAL */}
      {step === 4 && createdInscription && (
        <StepSuccess
          createdInscription={createdInscription}
          formData={formData}
          selectedDiscipline={selectedDiscipline}
          selectedCategory={selectedCategory}
          onCopyCode={handleCopyCode}
          onDownloadQr={handleDownloadQr}
          onPrint={handlePrint}
          onReset={handleResetForm}
        />
      )}
    </div>
  );
}
