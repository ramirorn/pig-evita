// ===========================================
// useInscriptionWizard — estado del asistente de inscripción (pública y delegados)
// ===========================================
import { useMemo, useState } from 'react';
import type React from 'react';
import { toast } from 'sonner';
import { Sex, type Inscription } from '@/types';
import { useDisciplines } from '@/hooks/useDisciplines';
import { useCategories } from '@/hooks/useCategories';
import { useCreateInscription } from '@/hooks/useInscriptions';
import { logError } from '@/lib/logger';
import type { InscriptionFormData } from './StepPersonalData';

/** 1: Personal, 2: Disciplina, 3: Confirmación, 4: Credencial. */
export type WizardStep = 1 | 2 | 3 | 4;

const EMPTY_FORM: InscriptionFormData = {
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
};

interface InscriptionWizardOptions {
  /**
   * Cómo se nombra al inscripto en los mensajes de error de compatibilidad.
   * En la inscripción pública el que carga los datos es el propio participante
   * ("Tu edad"); en el panel de delegados es un tercero ("La edad del
   * participante").
   */
  ageSubject?: string;
  /** Prefijo con el que se identifica el origen en los logs de error. */
  logScope?: string;
}

/**
 * Toda la máquina de estados de la inscripción: los datos cargados, en qué paso
 * está, qué se deriva de esos datos (edad, categorías compatibles) y las
 * validaciones que habilitan cada avance.
 *
 * Vive fuera de la página porque no tiene nada de layout: la página sólo elige
 * qué paso mostrar. Devuelve un objeto único en lugar de una tupla para que los
 * subcomponentes de paso reciban exactamente lo que ya recibían por props.
 *
 * Lo usan las dos inscripciones —la pública y la del panel de delegados—, que
 * eran el mismo asistente duplicado línea por línea y sólo se diferencian en
 * cómo le hablan al que está cargando los datos.
 */
export function useInscriptionWizard({
  ageSubject = 'Tu edad',
  logScope = 'InscriptionPage',
}: InscriptionWizardOptions = {}) {
  const [step, setStep] = useState<WizardStep>(1);
  const [formData, setFormData] = useState<InscriptionFormData>(EMPTY_FORM);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [createdInscription, setCreatedInscription] = useState<Inscription | null>(null);

  const { data: disciplinesData, isLoading: loadingDisciplines } = useDisciplines({ limit: 100 });
  const { data: categoriesData, isLoading: loadingCategories } = useCategories({ limit: 100 });
  const createMutation = useCreateInscription();

  // Edad calculada a partir de la fecha de nacimiento.
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

  // Sólo las categorías activas de la disciplina elegida.
  const availableCategories = useMemo(() => {
    if (!formData.disciplineId || !categoriesData?.data) return [];
    return categoriesData.data.filter(
      (cat) => cat.disciplineId === formData.disciplineId && cat.isActive,
    );
  }, [formData.disciplineId, categoriesData]);

  const selectedDiscipline = useMemo(() => {
    return disciplinesData?.data.find((d) => d.id === formData.disciplineId);
  }, [formData.disciplineId, disciplinesData]);

  const selectedCategory = useMemo(() => {
    return categoriesData?.data.find((c) => c.id === formData.categoryId);
  }, [formData.categoryId, categoriesData]);

  // Chequeo de edad y sexo contra la categoría elegida.
  const categoryCompatibility = useMemo(() => {
    if (!selectedCategory || calculatedAge === null) return { valid: true, message: '' };

    if (calculatedAge < selectedCategory.minAge || calculatedAge > selectedCategory.maxAge) {
      return {
        valid: false,
        message: `${ageSubject} (${calculatedAge} años) no está dentro del rango permitido (${selectedCategory.minAge} a ${selectedCategory.maxAge} años).`,
      };
    }

    if (selectedCategory.sex !== Sex.MIXTO && selectedCategory.sex !== formData.sex) {
      return {
        valid: false,
        message: `Esta categoría está designada para ${selectedCategory.sex === Sex.FEMENINO ? 'Femenino' : 'Masculino'}.`,
      };
    }

    return { valid: true, message: '¡Cumple todos los requisitos de edad y categoría!' };
  }, [selectedCategory, calculatedAge, formData.sex, ageSubject]);

  /** Cada avance de paso vuelve al tope: el formulario es más alto que la pantalla. */
  const goToStep = (next: WizardStep) => {
    setStep(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
    goToStep(2);
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
    goToStep(3);
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
      goToStep(4);
    } catch (err) {
      logError(`${logScope}.handleSubmitInscription`, err);
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
    setFormData(EMPTY_FORM);
    setTermsAccepted(false);
    setCreatedInscription(null);
    setStep(1);
  };

  return {
    step,
    setStep,
    formData,
    setFormData,
    termsAccepted,
    setTermsAccepted,
    createdInscription,
    disciplines: disciplinesData?.data,
    availableCategories,
    selectedDiscipline,
    selectedCategory,
    categoryCompatibility,
    calculatedAge,
    loadingDisciplines,
    loadingCategories,
    isSubmitting: createMutation.isPending,
    handleNextToSport,
    handleNextToReview,
    handleSubmitInscription,
    handleDownloadQr,
    handleCopyCode,
    handlePrint,
    handleResetForm,
  };
}

export type InscriptionWizard = ReturnType<typeof useInscriptionWizard>;
