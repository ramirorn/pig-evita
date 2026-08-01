// ===========================================
// Inscription Page — Public Enrollment & QR Tracking
// Juegos Evita Formoseños Oficial
// ===========================================
import { useState, useMemo, useRef } from 'react';
import { Link } from 'react-router';
import {
  Trophy,
  ClipboardList,
  CheckCircle2,
  QrCode,
  Search,
  User,
  Calendar,
  MapPin,
  Phone,
  Mail,
  ArrowRight,
  ArrowLeft,
  Download,
  Printer,
  Copy,
  ShieldCheck,
  AlertCircle,
  Check,
  Sparkles,
  Clock,
  XCircle,
  FileCheck2,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import { ROUTES } from '@/lib/constants';
import { Sex, InscriptionStatus, type Inscription } from '@/types';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
import { useCreateInscription, useInscriptionByQr } from '@/hooks/useInscriptions';

const DEPARTMENTS_FORMOSA = [
  'Formosa',
  'Bermejo',
  'Laishí',
  'Matacos',
  'Patiño',
  'Pilagás',
  'Pilcomayo',
  'Pirané',
  'Ramón Lista',
];

type TabMode = 'register' | 'track';
type WizardStep = 1 | 2 | 3 | 4; // 1: Personal, 2: Sport, 3: Review, 4: Success

export function InscriptionPage() {
  const [activeTab, setActiveTab] = useState<TabMode>('register');
  const [step, setStep] = useState<WizardStep>(1);

  // Form State
  const [formData, setFormData] = useState({
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
              <form onSubmit={handleNextToSport} className="card p-6 md:p-8 space-y-6 animate-fade-in shadow-md">
                <div className="flex items-center gap-2.5 pb-4 border-b border-primary-100 text-primary-800 font-bold text-lg">
                  <User className="w-5 h-5 text-accent-600" />
                  <span>Paso 1: Datos Personales del Participante</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* DNI */}
                  <div>
                    <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1.5">
                      DNI (Sin puntos) *
                    </label>
                    <input
                      type="text"
                      maxLength={8}
                      required
                      placeholder="Ej: 45123456"
                      value={formData.dni}
                      onChange={(e) => setFormData({ ...formData, dni: e.target.value.replace(/\D/g, '') })}
                      className="w-full px-4 py-2.5 rounded-xl border border-primary-200 text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                    />
                  </div>

                  {/* Sexo */}
                  <div>
                    <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1.5">
                      Sexo Biológico / Rama *
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, sex: Sex.MASCULINO })}
                        className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all border ${
                          formData.sex === Sex.MASCULINO
                            ? 'bg-primary-50 border-primary-500 text-primary-800 shadow-xs'
                            : 'border-primary-200 text-primary-600 hover:bg-surface'
                        }`}
                      >
                        👦 Masculino
                      </button>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, sex: Sex.FEMENINO })}
                        className={`py-2.5 px-4 rounded-xl text-xs font-bold transition-all border ${
                          formData.sex === Sex.FEMENINO
                            ? 'bg-primary-50 border-primary-500 text-primary-800 shadow-xs'
                            : 'border-primary-200 text-primary-600 hover:bg-surface'
                        }`}
                      >
                        👧 Femenino
                      </button>
                    </div>
                  </div>

                  {/* Nombre */}
                  <div>
                    <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1.5">
                      Nombre(s) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Lucas Matías"
                      value={formData.firstName}
                      onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-primary-200 text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                    />
                  </div>

                  {/* Apellido */}
                  <div>
                    <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1.5">
                      Apellido(s) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: González"
                      value={formData.lastName}
                      onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-primary-200 text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                    />
                  </div>

                  {/* Fecha de Nacimiento */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider">
                        Fecha de Nacimiento *
                      </label>
                      {calculatedAge !== null && (
                        <span className="text-xs font-bold text-accent-700 bg-accent-50 px-2 py-0.5 rounded-md">
                          Edad: {calculatedAge} años
                        </span>
                      )}
                    </div>
                    <input
                      type="date"
                      required
                      value={formData.birthDate}
                      onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-primary-200 text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                    />
                  </div>

                  {/* Teléfono */}
                  <div>
                    <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1.5">
                      Teléfono de Contacto
                    </label>
                    <input
                      type="tel"
                      placeholder="Ej: 3704 123456"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-primary-200 text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1.5">
                      Correo Electrónico
                    </label>
                    <input
                      type="email"
                      placeholder="Ej: atleta@gmail.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-primary-200 text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                    />
                  </div>

                  {/* Departamento */}
                  <div>
                    <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1.5">
                      Departamento de Formosa *
                    </label>
                    <select
                      value={formData.department}
                      onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-primary-200 text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium bg-white"
                    >
                      {DEPARTMENTS_FORMOSA.map((dept) => (
                        <option key={dept} value={dept}>
                          {dept}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Localidad */}
                  <div>
                    <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1.5">
                      Localidad / Municipio *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Ej: Clorinda, Pirané, Formosa..."
                      value={formData.locality}
                      onChange={(e) => setFormData({ ...formData, locality: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-primary-200 text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                    />
                  </div>

                  {/* Domicilio */}
                  <div>
                    <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-1.5">
                      Domicilio / Barrio
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: B° San Martín, Calle Belgrano 123"
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      className="w-full px-4 py-2.5 rounded-xl border border-primary-200 text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white bg-primary-800 hover:bg-primary-900 shadow-md hover:shadow-lg transition-all"
                  >
                    Siguiente: Selección Deportiva
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 2: SPORTS & CATEGORY */}
            {step === 2 && (
              <form onSubmit={handleNextToReview} className="card p-6 md:p-8 space-y-6 animate-fade-in shadow-md">
                <div className="flex items-center justify-between pb-4 border-b border-primary-100">
                  <div className="flex items-center gap-2.5 text-primary-800 font-bold text-lg">
                    <Trophy className="w-5 h-5 text-accent-600" />
                    <span>Paso 2: Disciplina y Categoría</span>
                  </div>
                  <span className="text-xs font-bold text-primary-700 bg-primary-50 px-3 py-1 rounded-full border border-primary-200">
                    Atleta: {formData.firstName} {formData.lastName} ({calculatedAge} años)
                  </span>
                </div>

                {/* Disciplines Selection */}
                <div>
                  <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-2">
                    1. Seleccioná la Disciplina Deportiva *
                  </label>
                  {loadingDisciplines ? (
                    <div className="p-8 text-center text-primary-400 text-sm">Cargando disciplinas deportivas...</div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-64 overflow-y-auto p-1">
                      {disciplinesData?.data.map((discipline) => {
                        const isSelected = formData.disciplineId === discipline.id;
                        return (
                          <button
                            key={discipline.id}
                            type="button"
                            onClick={() => setFormData({ ...formData, disciplineId: discipline.id, categoryId: '' })}
                            className={`p-3 rounded-xl text-left border transition-all flex flex-col justify-between ${
                              isSelected
                                ? 'border-primary-800 bg-primary-50 text-primary-900 ring-2 ring-primary-700 shadow-xs'
                                : 'border-primary-200 bg-white hover:border-primary-300 text-primary-700'
                            }`}
                          >
                            <span className="font-bold text-xs line-clamp-1">{discipline.name}</span>
                            <div className="flex items-center gap-1 mt-2">
                              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded-md bg-white border border-primary-100 text-primary-600">
                                {discipline.type}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Categories Selection */}
                {formData.disciplineId && (
                  <div className="pt-4 border-t border-primary-100 animate-fade-in">
                    <label className="block text-xs font-bold text-primary-700 uppercase tracking-wider mb-2">
                      2. Seleccioná la Categoría Oficial *
                    </label>

                    {loadingCategories ? (
                      <div className="p-4 text-center text-primary-400 text-sm">Cargando categorías...</div>
                    ) : availableCategories.length === 0 ? (
                      <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                        No hay categorías activas para esta disciplina en este momento.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {availableCategories.map((category) => {
                          const isSelected = formData.categoryId === category.id;
                          const isAgeValid =
                            calculatedAge !== null &&
                            calculatedAge >= category.minAge &&
                            calculatedAge <= category.maxAge;
                          const isSexValid =
                            category.sex === Sex.MIXTO || category.sex === formData.sex;
                          const isValid = isAgeValid && isSexValid;

                          return (
                            <button
                              key={category.id}
                              type="button"
                              onClick={() => setFormData({ ...formData, categoryId: category.id })}
                              className={`p-4 rounded-xl text-left border transition-all ${
                                isSelected
                                  ? 'border-secondary-600 bg-secondary-50 text-secondary-900 ring-2 ring-secondary-500 shadow-sm'
                                  : isValid
                                  ? 'border-primary-200 bg-white hover:border-primary-300 text-primary-800'
                                  : 'border-primary-100 bg-primary-50/50 text-primary-400 opacity-60'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-sm">{category.name}</span>
                                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white border border-primary-100 text-primary-700">
                                  {category.minAge} - {category.maxAge} años
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-2 text-xs">
                                <span className="font-medium text-primary-600">
                                  Rama: {category.sex}
                                </span>
                                {isValid ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-secondary-600">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Compatible
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700">
                                    <AlertCircle className="w-3.5 h-3.5" /> Fuera de rango
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Compatibility Warning Box */}
                    {selectedCategory && (
                      <div className="mt-4">
                        {categoryCompatibility.valid ? (
                          <div className="p-3.5 rounded-xl bg-secondary-50 border border-secondary-200 text-secondary-800 text-xs flex items-center gap-2 font-medium">
                            <CheckCircle2 className="w-4 h-4 text-secondary-600 flex-shrink-0" />
                            <span>{categoryCompatibility.message}</span>
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-xl bg-destructive-50 border border-red-200 text-destructive-700 text-xs flex items-center gap-2 font-medium">
                            <AlertCircle className="w-4 h-4 text-destructive-500 flex-shrink-0" />
                            <span>{categoryCompatibility.message}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                <div className="pt-4 flex items-center justify-between border-t border-primary-100">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-600 hover:text-primary-900 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a Datos Personales
                  </button>

                  <button
                    type="submit"
                    disabled={!formData.categoryId || !categoryCompatibility.valid}
                    className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white bg-primary-800 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
                  >
                    Revisar Inscripción
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: REVIEW & CONFIRM */}
            {step === 3 && (
              <div className="card p-6 md:p-8 space-y-6 animate-fade-in shadow-md">
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
                      <p><span className="font-semibold">Rango de Edad:</span> {selectedCategory?.minAge} a {selectedCategory?.maxAge} años</p>
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
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(e) => setTermsAccepted(e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-primary-300 text-primary-800 focus:ring-primary-500"
                    />
                    <span className="text-xs text-primary-800 leading-relaxed font-medium">
                      Declaro bajo juramento que los datos ingresados son verídicos y corresponden al participante.
                      Acepto el reglamento general y normativas de los Juegos Evita Formoseños 2026.
                    </span>
                  </label>
                </div>

                <div className="pt-4 flex items-center justify-between border-t border-primary-100">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-600 hover:text-primary-900 transition-colors"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a Disciplina
                  </button>

                  <button
                    type="button"
                    onClick={handleSubmitInscription}
                    disabled={!termsAccepted || createMutation.isPending}
                    className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-secondary-500 to-secondary-600 hover:from-secondary-600 hover:to-secondary-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all active:scale-[0.98]"
                  >
                    {createMutation.isPending ? (
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
            )}

            {/* STEP 4: SUCCESS CREDENTIAL */}
            {step === 4 && createdInscription && (
              <div className="max-w-2xl mx-auto animate-scale-in space-y-6">
                {/* Success Banner */}
                <div className="text-center">
                  <div className="w-16 h-16 mx-auto mb-3 rounded-full bg-secondary-50 flex items-center justify-center border-4 border-secondary-200 shadow-sm">
                    <CheckCircle2 className="w-9 h-9 text-secondary-600" />
                  </div>
                  <h2 className="text-2xl md:text-3xl font-extrabold text-primary-900 tracking-tight">
                    ¡Inscripción Registrada con Éxito!
                  </h2>
                  <p className="text-primary-600 text-sm mt-1 max-w-md mx-auto">
                    Tu solicitud ha sido generada correctamente. Guardá tu credencial oficial con código QR para el control en las sedes.
                  </p>
                </div>

                {/* Official Credential Card */}
                <div className="card overflow-hidden border-2 border-primary-800 shadow-xl bg-white">
                  {/* Credential Header */}
                  <div className="bg-gradient-to-r from-primary-800 via-primary-900 to-primary-800 text-white p-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src="/logo-sinfondo.png"
                        alt="Juegos Evita Formoseños"
                        className="h-12 w-auto object-contain drop-shadow-sm"
                      />
                      <div>
                        <h3 className="font-extrabold text-base tracking-tight leading-tight">
                          JUEGOS EVITA FORMOSEÑOS
                        </h3>
                        <p className="text-[10px] text-accent-400 font-bold uppercase tracking-widest leading-tight">
                          Credencial Oficial de Inscripción
                        </p>
                      </div>
                    </div>

                    <span className="text-xs font-bold text-amber-900 bg-accent-400 px-3 py-1 rounded-full shadow-xs">
                      {createdInscription.status}
                    </span>
                  </div>

                  {/* Credential Body */}
                  <div className="p-6 md:p-8 grid grid-cols-1 sm:grid-cols-2 gap-6 items-center">
                    {/* QR Code Presentation */}
                    <div className="flex flex-col items-center justify-center p-4 rounded-2xl bg-surface border border-primary-100">
                      {createdInscription.qrImage ? (
                        <img
                          src={createdInscription.qrImage}
                          alt={`QR ${createdInscription.qrCode}`}
                          className="w-48 h-48 rounded-xl shadow-xs border border-primary-100"
                        />
                      ) : (
                        <div className="w-48 h-48 bg-primary-50 rounded-xl flex items-center justify-center">
                          <QrCode className="w-16 h-16 text-primary-400" />
                        </div>
                      )}

                      <div className="mt-3 flex items-center gap-2">
                        <span className="font-mono text-sm font-extrabold text-primary-900 bg-white px-3 py-1 rounded-lg border border-primary-200">
                          {createdInscription.qrCode}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyCode(createdInscription.qrCode)}
                          className="p-1.5 rounded-lg text-primary-500 hover:text-primary-800 hover:bg-primary-100 transition-colors"
                          title="Copiar código"
                        >
                          <Copy className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Participant Details */}
                    <div className="space-y-3 text-sm">
                      <div>
                        <span className="text-[11px] font-bold text-primary-400 uppercase tracking-wider block">
                          Participante
                        </span>
                        <p className="font-extrabold text-lg text-primary-900 leading-tight">
                          {createdInscription.participant?.lastName}, {createdInscription.participant?.firstName}
                        </p>
                        <p className="text-xs text-primary-600 font-medium">
                          DNI: {createdInscription.participant?.dni}
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary-100 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider block">
                            Disciplina
                          </span>
                          <p className="font-bold text-primary-800">
                            {createdInscription.category?.discipline?.name || selectedDiscipline?.name}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider block">
                            Categoría
                          </span>
                          <p className="font-bold text-primary-800">
                            {createdInscription.category?.name || selectedCategory?.name}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-primary-100 text-xs">
                        <div>
                          <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider block">
                            Departamento
                          </span>
                          <p className="font-medium text-primary-700">
                            {createdInscription.participant?.department || formData.department}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-primary-400 uppercase tracking-wider block">
                            Localidad
                          </span>
                          <p className="font-medium text-primary-700">
                            {createdInscription.participant?.locality || formData.locality}
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-primary-100 text-[11px] text-primary-500">
                        Fecha: {new Date().toLocaleDateString('es-AR')}
                      </div>
                    </div>
                  </div>

                  {/* Actions footer */}
                  <div className="p-4 bg-surface border-t border-primary-100 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={handleDownloadQr}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-primary-800 hover:bg-primary-900 shadow-sm transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Descargar QR
                    </button>
                    <button
                      type="button"
                      onClick={handlePrint}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-primary-800 bg-white border border-primary-200 hover:bg-primary-50 transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Imprimir Comprobante
                    </button>
                  </div>
                </div>

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={handleResetForm}
                    className="text-xs font-bold text-primary-600 hover:text-primary-900 transition-colors"
                  >
                    + Inscribir a otro participante
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: QR / DNI TRACKING */}
        {activeTab === 'track' && (
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
            <form onSubmit={handleTrackSubmit} className="card p-4 flex gap-2 shadow-sm">
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
        )}
      </div>
    </div>
  );
}
