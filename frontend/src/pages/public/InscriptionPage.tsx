// ===========================================
// Inscription Page — Public Enrollment & QR Tracking
// Juegos Evita Formoseños Oficial
// ===========================================
import React, { useState, useMemo } from 'react';
import { Link } from 'react-router';
import { ClipboardList, Search, Check } from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES } from '@/lib/constants';
import { Sex, type Inscription } from '@/types';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
import { useCreateInscription, useInscriptionByQr } from '@/hooks/useInscriptions';

import { StepPersonalData, type InscriptionFormData } from './inscription/StepPersonalData';
import { StepSportSelection } from './inscription/StepSportSelection';
import { StepReview } from './inscription/StepReview';
import { StepSuccess } from './inscription/StepSuccess';
import { TrackInscription } from './inscription/TrackInscription';

type TabMode = 'register' | 'track';
type WizardStep = 1 | 2 | 3 | 4; // 1: Personal, 2: Sport, 3: Review, 4: Success

export function InscriptionPage() {
  const [activeTab, setActiveTab] = useState<TabMode>('register');
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

  // QR Tracking State
  const [searchQr, setSearchQr] = useState('');
  const [submittedQr, setSubmittedQr] = useState('');

  // Queries & Mutations
  const { data: disciplinesData, isLoading: loadingDisciplines } = useDisciplines({ limit: 100 });
  const { data: categoriesData, isLoading: loadingCategories } = useCategories({ limit: 100 });
  const createMutation = useCreateInscription();
  const { data: trackedInscription, isLoading: loadingTrack, isError: errorTrack } = useInscriptionByQr(submittedQr);

  // Calculate age based on birthDate
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

  // Check category age and sex compatibility
  const categoryCompatibility = useMemo(() => {
    if (!selectedCategory || calculatedAge === null) return { valid: true, message: '' };

    if (calculatedAge < selectedCategory.minAge || calculatedAge > selectedCategory.maxAge) {
      return {
        valid: false,
        message: `Tu edad (${calculatedAge} años) no está dentro del rango permitido (${selectedCategory.minAge} a ${selectedCategory.maxAge} años).`,
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

  // Handlers for Wizard navigation
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
      console.error(err);
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
          <Link to={ROUTES.HOME} className="flex items-center gap-3 group">
            <img
              src="/logo-sinfondo.png"
              alt="Juegos Evita Formoseños"
              className="h-11 w-auto object-contain transition-transform group-hover:scale-105"
            />
            <div>
              <span className="text-base font-extrabold text-primary-800 tracking-tight block leading-tight">
                Juegos Evita Formoseños
              </span>
              <span className="text-[10px] text-accent-600 font-bold uppercase tracking-widest block leading-tight">
                Inscripciones 2026
              </span>
            </div>
          </Link>

          <Link
            to={ROUTES.HOME}
            className="text-xs font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1 transition-colors"
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
                if (step === 4) setStep(1);
              }}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'register'
                  ? 'bg-primary-800 text-white shadow-sm'
                  : 'text-primary-600 hover:text-primary-800 hover:bg-primary-50'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              Nueva Inscripción
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('track')}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'track'
                  ? 'bg-primary-800 text-white shadow-sm'
                  : 'text-primary-600 hover:text-primary-800 hover:bg-primary-50'
              }`}
            >
              <Search className="w-4 h-4" />
              Consultar Estado por QR
            </button>
          </div>
        </div>

        {/* TAB 1: REGISTRATION WIZARD */}
        {activeTab === 'register' && (
          <div>
            {step < 4 && (
              <div className="mb-8 text-center animate-fade-in">
                <h1 className="text-3xl font-extrabold text-primary-800 tracking-tight mb-2">
                  Inscripción a los Juegos Evita
                </h1>
                <p className="text-primary-600 max-w-lg mx-auto text-sm">
                  Completá tus datos para obtener tu credencial oficial y participar en las etapas de competencia provincial.
                </p>

                {/* Stepper Progress Bar */}
                <div className="max-w-xl mx-auto mt-8">
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
        )}

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
