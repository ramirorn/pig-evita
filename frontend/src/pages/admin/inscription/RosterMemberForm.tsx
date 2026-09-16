// ===========================================
// RosterMemberForm — el alta (o la corrección) de un integrante
// ===========================================
import { useEffect, useState } from 'react';
import type React from 'react';
import { UserPlus, Save, X, AlertCircle, Star } from 'lucide-react';
import { Sex } from '@/types';
import type { TeamMemberValues } from '@/schemas';
import { DEPARTMENTS_FORMOSA } from '../../public/inscription/StepPersonalData';
import type { PlantelRequerido, RosterMember } from './rosterModel';

/**
 * Estado del formulario: los mismos campos que `TeamMemberValues`, pero con los
 * opcionales como `string` en vez de `string | undefined`, porque un input
 * controlado con `value={undefined}` pasa a no controlado y React lo avisa a
 * los gritos. La normalización a `undefined` la hace el schema al validar.
 */
interface MemberFormState {
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
  isSubstitute: boolean;
  position: string;
  shirtNumber: string;
  isCaptain: boolean;
}

function estadoVacio(department: string, locality: string, isSubstitute: boolean): MemberFormState {
  return {
    dni: '',
    firstName: '',
    lastName: '',
    birthDate: '',
    sex: Sex.MASCULINO,
    phone: '',
    email: '',
    // El equipo entero suele ser de la misma localidad: arrastrar el domicilio
    // del equipo ahorra dos campos por cada uno de los 16.
    department,
    locality,
    address: '',
    isSubstitute,
    position: '',
    shirtNumber: '',
    isCaptain: false,
  };
}

function aEstado(integrante: RosterMember): MemberFormState {
  return {
    dni: integrante.dni,
    firstName: integrante.firstName,
    lastName: integrante.lastName,
    birthDate: integrante.birthDate,
    sex: integrante.sex,
    phone: integrante.phone ?? '',
    email: integrante.email ?? '',
    department: integrante.department,
    locality: integrante.locality,
    address: integrante.address ?? '',
    isSubstitute: integrante.isSubstitute,
    position: integrante.position ?? '',
    shirtNumber:
      typeof integrante.shirtNumber === 'number' ? String(integrante.shirtNumber) : '',
    isCaptain: integrante.isCaptain,
  };
}

function aValores(estado: MemberFormState): TeamMemberValues {
  const dorsal = estado.shirtNumber.trim();
  return {
    dni: estado.dni,
    firstName: estado.firstName,
    lastName: estado.lastName,
    birthDate: estado.birthDate,
    sex: estado.sex,
    phone: estado.phone,
    email: estado.email,
    department: estado.department,
    locality: estado.locality,
    address: estado.address,
    isSubstitute: estado.isSubstitute,
    position: estado.position,
    shirtNumber: dorsal === '' ? undefined : Number(dorsal),
    isCaptain: estado.isCaptain,
  };
}

const CLASE_INPUT =
  'w-full px-3 py-2 rounded-xl border border-primary-200 text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium';
const CLASE_LABEL =
  'block text-[11px] font-bold text-primary-700 uppercase tracking-wider mb-1';

interface RosterMemberFormProps {
  /** El integrante en edición, o `null` para un alta nueva. */
  editando: RosterMember | null;
  requerido: PlantelRequerido;
  /** Lugares libres, para no ofrecer un rol que ya no entra. */
  lugarTitular: boolean;
  lugarSuplente: boolean;
  /** Domicilio del equipo, que se arrastra como valor inicial de cada ficha. */
  departamentoEquipo: string;
  localidadEquipo: string;
  /** Devuelve `null` si entró, o el motivo del rechazo. */
  onGuardar: (valores: TeamMemberValues) => string | null;
  onCancelarEdicion: () => void;
}

export function RosterMemberForm({
  editando,
  requerido,
  lugarTitular,
  lugarSuplente,
  departamentoEquipo,
  localidadEquipo,
  onGuardar,
  onCancelarEdicion,
}: RosterMemberFormProps) {
  const [estado, setEstado] = useState<MemberFormState>(() =>
    estadoVacio(departamentoEquipo, localidadEquipo, !lugarTitular),
  );
  const [error, setError] = useState<string | null>(null);

  // Al tocar "Editar" en la lista, la ficha del elegido baja al formulario.
  useEffect(() => {
    if (editando) {
      setEstado(aEstado(editando));
      setError(null);
    }
  }, [editando]);

  const patch = (cambios: Partial<MemberFormState>) =>
    setEstado((actual) => ({ ...actual, ...cambios }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const motivo = onGuardar(aValores(estado));
    if (motivo) {
      setError(motivo);
      return;
    }
    setError(null);
    // Vuelve en blanco listo para el siguiente. El rol se preselecciona según
    // qué cupo quede: cuando los titulares están completos, lo próximo que se
    // carga es un suplente.
    setEstado(estadoVacio(departamentoEquipo, localidadEquipo, !lugarTitular));
  };

  const handleCancelar = () => {
    setError(null);
    setEstado(estadoVacio(departamentoEquipo, localidadEquipo, !lugarTitular));
    onCancelarEdicion();
  };

  const puedeSerTitular = lugarTitular || editando?.isSubstitute === false;
  const puedeSerSuplente =
    (lugarSuplente || editando?.isSubstitute === true) && requerido.maxSuplentes > 0;

  return (
    <form
      onSubmit={handleSubmit}
      className="card p-5 md:p-6 space-y-5 shadow-sm border border-primary-200"
    >
      <div className="flex items-center justify-between pb-3 border-b border-primary-100">
        <div className="flex items-center gap-2 text-primary-800 font-bold">
          {editando ? (
            <Save className="w-4 h-4 text-accent-600" aria-hidden="true" />
          ) : (
            <UserPlus className="w-4 h-4 text-accent-600" aria-hidden="true" />
          )}
          <span>
            {editando
              ? `Corrigiendo a ${editando.firstName} ${editando.lastName}`
              : 'Agregar integrante'}
          </span>
        </div>
        {editando && (
          <button
            type="button"
            onClick={handleCancelar}
            className="inline-flex items-center gap-1 text-xs font-bold text-primary-600 hover:text-primary-900"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" />
            Cancelar
          </button>
        )}
      </div>

      {/* Rol dentro del plantel */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <span className={CLASE_LABEL}>Rol en el plantel *</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!puedeSerTitular}
              aria-pressed={!estado.isSubstitute}
              onClick={() => patch({ isSubstitute: false })}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
                estado.isSubstitute
                  ? 'border-primary-200 text-primary-600 hover:bg-surface'
                  : 'bg-primary-50 border-primary-500 text-primary-800 shadow-xs'
              }`}
            >
              Titular
            </button>
            <button
              type="button"
              disabled={!puedeSerSuplente}
              aria-pressed={estado.isSubstitute}
              onClick={() => patch({ isSubstitute: true })}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border disabled:opacity-40 disabled:cursor-not-allowed ${
                estado.isSubstitute
                  ? 'bg-primary-50 border-primary-500 text-primary-800 shadow-xs'
                  : 'border-primary-200 text-primary-600 hover:bg-surface'
              }`}
            >
              Suplente
            </button>
          </div>
        </div>

        <div className="flex items-end">
          <label className="flex items-center gap-2 cursor-pointer select-none px-3 py-2 rounded-xl border border-primary-200 w-full">
            <input
              type="checkbox"
              checked={estado.isCaptain}
              onChange={(e) => patch({ isCaptain: e.target.checked })}
              className="h-4 w-4 rounded border-primary-300 text-primary-800 focus:ring-primary-500"
            />
            <Star className="w-4 h-4 text-accent-600" aria-hidden="true" />
            <span className="text-xs font-bold text-primary-800">Es capitán del equipo</span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className={CLASE_LABEL} htmlFor="integrante-dni">
            DNI (sin puntos) *
          </label>
          <input
            id="integrante-dni"
            type="text"
            inputMode="numeric"
            maxLength={8}
            required
            placeholder="Ej: 45123456"
            value={estado.dni}
            onChange={(e) => patch({ dni: e.target.value.replace(/\D/g, '') })}
            className={CLASE_INPUT}
          />
        </div>

        <div>
          <span className={CLASE_LABEL}>Sexo biológico / Rama *</span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              aria-pressed={estado.sex === Sex.MASCULINO}
              onClick={() => patch({ sex: Sex.MASCULINO })}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                estado.sex === Sex.MASCULINO
                  ? 'bg-primary-50 border-primary-500 text-primary-800 shadow-xs'
                  : 'border-primary-200 text-primary-600 hover:bg-surface'
              }`}
            >
              Masculino
            </button>
            <button
              type="button"
              aria-pressed={estado.sex === Sex.FEMENINO}
              onClick={() => patch({ sex: Sex.FEMENINO })}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-all border ${
                estado.sex === Sex.FEMENINO
                  ? 'bg-primary-50 border-primary-500 text-primary-800 shadow-xs'
                  : 'border-primary-200 text-primary-600 hover:bg-surface'
              }`}
            >
              Femenino
            </button>
          </div>
        </div>

        <div>
          <label className={CLASE_LABEL} htmlFor="integrante-nombre">
            Nombre(s) *
          </label>
          <input
            id="integrante-nombre"
            type="text"
            required
            placeholder="Ej: Lucas Matías"
            value={estado.firstName}
            onChange={(e) => patch({ firstName: e.target.value })}
            className={CLASE_INPUT}
          />
        </div>

        <div>
          <label className={CLASE_LABEL} htmlFor="integrante-apellido">
            Apellido(s) *
          </label>
          <input
            id="integrante-apellido"
            type="text"
            required
            placeholder="Ej: González"
            value={estado.lastName}
            onChange={(e) => patch({ lastName: e.target.value })}
            className={CLASE_INPUT}
          />
        </div>

        <div>
          <label className={CLASE_LABEL} htmlFor="integrante-nacimiento">
            Fecha de nacimiento *
          </label>
          <input
            id="integrante-nacimiento"
            type="date"
            required
            value={estado.birthDate}
            onChange={(e) => patch({ birthDate: e.target.value })}
            className={CLASE_INPUT}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={CLASE_LABEL} htmlFor="integrante-posicion">
              Posición
            </label>
            <input
              id="integrante-posicion"
              type="text"
              placeholder="Ej: Arquero"
              value={estado.position}
              onChange={(e) => patch({ position: e.target.value })}
              className={CLASE_INPUT}
            />
          </div>
          <div>
            <label className={CLASE_LABEL} htmlFor="integrante-dorsal">
              N° camiseta
            </label>
            <input
              id="integrante-dorsal"
              type="text"
              inputMode="numeric"
              maxLength={3}
              placeholder="Ej: 10"
              value={estado.shirtNumber}
              onChange={(e) => patch({ shirtNumber: e.target.value.replace(/\D/g, '') })}
              className={CLASE_INPUT}
            />
          </div>
        </div>

        <div>
          <label className={CLASE_LABEL} htmlFor="integrante-departamento">
            Departamento *
          </label>
          <select
            id="integrante-departamento"
            value={estado.department}
            onChange={(e) => patch({ department: e.target.value })}
            className={`${CLASE_INPUT} bg-white`}
          >
            {DEPARTMENTS_FORMOSA.map((departamento) => (
              <option key={departamento} value={departamento}>
                {departamento}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className={CLASE_LABEL} htmlFor="integrante-localidad">
            Localidad / Municipio *
          </label>
          <input
            id="integrante-localidad"
            type="text"
            required
            placeholder="Ej: Clorinda"
            value={estado.locality}
            onChange={(e) => patch({ locality: e.target.value })}
            className={CLASE_INPUT}
          />
        </div>

        <div>
          <label className={CLASE_LABEL} htmlFor="integrante-telefono">
            Teléfono de contacto
          </label>
          <input
            id="integrante-telefono"
            type="tel"
            placeholder="Ej: 3704 123456"
            value={estado.phone}
            onChange={(e) => patch({ phone: e.target.value })}
            className={CLASE_INPUT}
          />
        </div>

        <div>
          <label className={CLASE_LABEL} htmlFor="integrante-email">
            Correo electrónico
          </label>
          <input
            id="integrante-email"
            type="email"
            placeholder="Ej: familia@gmail.com"
            value={estado.email}
            onChange={(e) => patch({ email: e.target.value })}
            className={CLASE_INPUT}
          />
        </div>

        <div className="md:col-span-2">
          <label className={CLASE_LABEL} htmlFor="integrante-domicilio">
            Domicilio / Barrio
          </label>
          <input
            id="integrante-domicilio"
            type="text"
            placeholder="Ej: B° San Martín, Calle Belgrano 123"
            value={estado.address}
            onChange={(e) => patch({ address: e.target.value })}
            className={CLASE_INPUT}
          />
        </div>
      </div>

      {/*
        El motivo del rechazo queda fijo mientras se corrige el campo, en vez de
        irse con el toast. Con 16 fichas por delante, releer el error importa.
      */}
      {error && (
        <div
          role="alert"
          className="p-3 rounded-xl bg-destructive-50 border border-red-200 text-destructive-700 text-xs font-medium flex items-start gap-2"
        >
          <AlertCircle className="w-4 h-4 text-destructive-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-primary-800 hover:bg-primary-900 shadow-md transition-all"
        >
          {editando ? (
            <>
              <Save className="w-4 h-4" aria-hidden="true" />
              Guardar cambios
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4" aria-hidden="true" />
              Agregar al plantel
            </>
          )}
        </button>
      </div>
    </form>
  );
}
