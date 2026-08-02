// ===========================================
// Step 1: Personal Data Sub-component
// ===========================================
import React from 'react';
import { User, ArrowRight } from 'lucide-react';
import { Sex } from '@/types';

export const DEPARTMENTS_FORMOSA = [
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

export interface InscriptionFormData {
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  sex: Sex;
  phone: string;
  email: string;
  department: string;
  locality: string;
  address: string;
  disciplineId: string;
  categoryId: string;
}

interface StepPersonalDataProps {
  formData: InscriptionFormData;
  setFormData: React.Dispatch<React.SetStateAction<InscriptionFormData>>;
  calculatedAge: number | null;
  onNext: (e: React.FormEvent) => void;
}

export function StepPersonalData({
  formData,
  setFormData,
  calculatedAge,
  onNext,
}: StepPersonalDataProps) {
  return (
    <form onSubmit={onNext} className="card p-6 md:p-8 space-y-6 animate-fade-in shadow-md">
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
  );
}
