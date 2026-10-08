// ===========================================
// Paso 2: Carga del plantel
// ===========================================
import { useState } from 'react';
import {
  Users,
  ArrowLeft,
  ArrowRight,
  Pencil,
  Trash2,
  Star,
  AlertCircle,
  AlertTriangle,
  History,
  Info,
} from 'lucide-react';
import { RosterMemberForm } from './RosterMemberForm';
import { calcularEdad, hayLugar, type RosterMember } from './rosterModel';
import type { TeamInscriptionWizard } from './useTeamInscriptionWizard';
import { DEPARTMENT_OPTIONS } from '@/lib/constants';
import { SelectField } from '@/components/ui/select';

/** Contador siempre visible: es la única forma de saber cuánto falta. */
function ContadorPlantel({
  titulares,
  suplentes,
  requeridoTitulares,
  requeridoSuplentes,
}: {
  titulares: number;
  suplentes: number;
  requeridoTitulares: number;
  requeridoSuplentes: number;
}) {
  const completoTitulares = titulares === requeridoTitulares;

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      role="status"
      aria-live="polite"
      aria-label={`Titulares ${titulares} de ${requeridoTitulares}. Suplentes ${suplentes} de ${requeridoSuplentes}.`}
    >
      <span
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${
          completoTitulares
            ? 'bg-secondary-50 border-secondary-200 text-secondary-800'
            : 'bg-amber-50 border-amber-200 text-amber-800'
        }`}
      >
        Titulares {titulares}/{requeridoTitulares}
      </span>
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border bg-primary-50 border-primary-200 text-primary-800">
        Suplentes {suplentes}/{requeridoSuplentes}
      </span>
      {!completoTitulares && (
        <span className="text-xs font-medium text-primary-600">
          Faltan {requeridoTitulares - titulares} titulares para poder confirmar.
        </span>
      )}
    </div>
  );
}

function FilaIntegrante({
  integrante,
  enConflicto,
  enEdicion,
  onEditar,
  onEliminar,
}: {
  integrante: RosterMember;
  enConflicto: boolean;
  enEdicion: boolean;
  onEditar: () => void;
  onEliminar: () => void;
}) {
  const edad = calcularEdad(integrante.birthDate);

  return (
    <li
      className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
        enConflicto
          ? 'border-red-300 bg-destructive-50'
          : enEdicion
            ? 'border-primary-500 bg-primary-50'
            : 'border-primary-100 bg-white'
      }`}
    >
      <span
        className={`w-9 h-9 flex-shrink-0 rounded-full flex items-center justify-center text-[11px] font-bold ${
          integrante.isSubstitute
            ? 'bg-surface text-primary-600 border border-primary-200'
            : 'bg-primary-800 text-white'
        }`}
      >
        {integrante.isSubstitute ? 'SUP' : 'TIT'}
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-primary-900 truncate">
          {integrante.lastName}, {integrante.firstName}
          {integrante.isCaptain && (
            <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-accent-700 bg-accent-50 px-1.5 py-0.5 rounded-md align-middle">
              <Star className="w-3 h-3" aria-hidden="true" />
              Capitán
            </span>
          )}
        </p>
        <p className="text-xs text-primary-600 truncate">
          DNI {integrante.dni}
          {edad !== null ? ` · ${edad} años` : ''}
          {integrante.position ? ` · ${integrante.position}` : ''}
          {typeof integrante.shirtNumber === 'number' ? ` · N° ${integrante.shirtNumber}` : ''}
        </p>
        {enConflicto && (
          <p className="mt-1 text-xs font-bold text-destructive-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
            El sistema rechazó a esta persona. Corregí su ficha o sacala del plantel.
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={onEditar}
          aria-label={`Editar a ${integrante.firstName} ${integrante.lastName}`}
          className="p-2 rounded-lg text-primary-600 hover:text-primary-900 hover:bg-primary-100 transition-colors"
        >
          <Pencil className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onEliminar}
          aria-label={`Quitar del plantel a ${integrante.firstName} ${integrante.lastName}`}
          className="p-2 rounded-lg text-destructive-600 hover:text-destructive-700 hover:bg-destructive-50 transition-colors"
        >
          <Trash2 className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </li>
  );
}

export function StepRoster({ wizard }: { wizard: TeamInscriptionWizard }) {
  // Declarado antes de cualquier `return` temprano: los hooks no se pueden
  // llamar condicionalmente.
  const [confirmandoDescarte, setConfirmandoDescarte] = useState(false);

  const { plantelRequerido, selectedDiscipline, selectedCategory } = wizard;

  // Al restaurar un borrador se entra directo a este paso con los catálogos
  // todavía en vuelo. Sin esta guarda se vería un segundo el cartel de "no se
  // puede armar el plantel", que es exactamente lo que no hay que decirle a
  // alguien que acaba de recuperar 16 fichas.
  if (wizard.loadingDisciplines || wizard.loadingCategories) {
    return (
      <div className="card p-8 text-center text-sm text-primary-500 shadow-sm">
        Cargando la disciplina y la categoría...
      </div>
    );
  }

  // Puede pasar de verdad: se restauró un borrador y, mientras tanto, alguien
  // le sacó la configuración de plantel a la disciplina desde el ABM.
  if (!plantelRequerido || !selectedCategory) {
    return (
      <div className="card p-6 space-y-4 shadow-md" role="alert">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="text-sm text-amber-900">
            <p className="font-bold">No se puede armar el plantel todavía.</p>
            <p className="text-xs mt-1">
              La disciplina o la categoría elegidas no están disponibles, o la disciplina se quedó
              sin su configuración de titulares y suplentes. Tu plantel cargado no se borró.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={wizard.volverASeleccion}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-700 border border-primary-200 hover:bg-surface transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Volver a elegir disciplina
        </button>
      </div>
    );
  }

  const editando =
    wizard.integrantes.find((integrante) => integrante.id === wizard.editandoId) ?? null;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Encabezado pegajoso con el contador */}
      <div className="card p-5 shadow-md space-y-4 sticky top-2 z-20">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-primary-800 font-bold text-lg">
            <Users className="w-5 h-5 text-accent-600" aria-hidden="true" />
            <span>Paso 2: Plantel</span>
          </div>
          <span className="text-xs font-bold text-primary-700 bg-primary-50 px-3 py-1 rounded-full border border-primary-200">
            {selectedDiscipline?.name} · {selectedCategory.name}
          </span>
        </div>

        <ContadorPlantel
          titulares={wizard.conteo.titulares}
          suplentes={wizard.conteo.suplentes}
          requeridoTitulares={plantelRequerido.titulares}
          requeridoSuplentes={plantelRequerido.maxSuplentes}
        />
      </div>

      {wizard.borradorRestaurado && (
        <div className="p-4 rounded-xl bg-secondary-50 border border-secondary-200 flex items-start gap-3">
          <History className="w-5 h-5 text-secondary-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1 text-sm text-secondary-900">
            <p className="font-bold">Recuperamos el plantel que habías empezado.</p>
            <p className="text-xs mt-1">
              Volvieron {wizard.integrantes.length} integrantes tal como los habías cargado. Seguí
              desde donde quedaste, o descartalo si preferís arrancar de cero.
            </p>
            {/*
              El descarte va en dos toques a propósito. Es el único botón de
              esta pantalla que borra las 16 fichas, y está a un clic de
              distancia del que las acaba de recuperar.
            */}
            {confirmandoDescarte ? (
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <span className="text-xs font-bold">
                  ¿Seguro? Se pierden los {wizard.integrantes.length} integrantes cargados.
                </span>
                <button
                  type="button"
                  onClick={wizard.descartarBorrador}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-destructive-600 hover:bg-destructive-700 transition-colors"
                >
                  Sí, descartar
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmandoDescarte(false)}
                  className="text-xs font-bold text-secondary-800 underline underline-offset-2"
                >
                  No, seguir cargando
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmandoDescarte(true)}
                className="mt-2 text-xs font-bold text-secondary-800 underline underline-offset-2 hover:text-secondary-900"
              >
                Descartar y empezar de cero
              </button>
            )}
          </div>
        </div>
      )}

      {!wizard.storageDisponible && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 text-sm text-amber-900"
        >
          <AlertTriangle className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold">Este navegador no está guardando tu avance.</p>
            <p className="text-xs mt-1">
              No pudimos usar el almacenamiento local (puede ser una ventana privada o el espacio
              lleno). Si cerrás la pestaña vas a perder el plantel: terminá la carga sin salir de
              esta pantalla.
            </p>
          </div>
        </div>
      )}

      {wizard.errorEnvio && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-destructive-50 border border-red-200 flex items-start gap-3 text-sm text-destructive-700"
        >
          <AlertCircle className="w-5 h-5 text-destructive-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-bold">No se pudo inscribir el plantel.</p>
            <p className="text-xs mt-1">{wizard.errorEnvio}</p>
            <p className="text-xs mt-1 font-medium">
              No se creó ninguna inscripción y tu plantel quedó intacto. Corregí lo que haga falta y
              volvé a confirmar.
            </p>
          </div>
        </div>
      )}

      {/* Datos del equipo */}
      <div className="card p-5 md:p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2 text-primary-800 font-bold pb-3 border-b border-primary-100">
          <Users className="w-4 h-4 text-accent-600" aria-hidden="true" />
          <span>Datos del equipo</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-1">
            <label
              className="block text-[11px] font-bold text-primary-700 uppercase tracking-wider mb-1"
              htmlFor="equipo-nombre"
            >
              Nombre del equipo *
            </label>
            <input
              id="equipo-nombre"
              type="text"
              required
              placeholder="Ej: Escuela N° 12 Clorinda"
              value={wizard.equipo.teamName}
              onChange={(e) =>
                wizard.setEquipo((actual) => ({ ...actual, teamName: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl border border-primary-200 text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
            />
          </div>
          <div>
            <label
              className="block text-[11px] font-bold text-primary-700 uppercase tracking-wider mb-1"
              htmlFor="equipo-departamento"
            >
              Departamento *
            </label>
            <SelectField
              id="equipo-departamento"
              required
              value={wizard.equipo.department}
              onValueChange={(department) =>
                wizard.setEquipo((actual) => ({ ...actual, department }))
              }
              options={DEPARTMENT_OPTIONS}
            />
          </div>
          <div>
            <label
              className="block text-[11px] font-bold text-primary-700 uppercase tracking-wider mb-1"
              htmlFor="equipo-localidad"
            >
              Localidad *
            </label>
            <input
              id="equipo-localidad"
              type="text"
              required
              placeholder="Ej: Clorinda"
              value={wizard.equipo.locality}
              onChange={(e) =>
                wizard.setEquipo((actual) => ({ ...actual, locality: e.target.value }))
              }
              className="w-full px-3 py-2 rounded-xl border border-primary-200 text-primary-900 placeholder:text-primary-300 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm font-medium"
            />
          </div>
        </div>
      </div>

      {/* Lista de cargados */}
      <div className="card p-5 md:p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-primary-100">
          <span className="text-primary-800 font-bold">
            Integrantes cargados ({wizard.integrantes.length})
          </span>
        </div>

        {wizard.integrantes.length === 0 ? (
          <p className="py-6 text-center text-sm text-primary-500">
            Todavía no cargaste a nadie. Empezá por el formulario de abajo.
          </p>
        ) : (
          <ul className="space-y-2">
            {wizard.integrantes.map((integrante) => (
              <FilaIntegrante
                key={integrante.id}
                integrante={integrante}
                enConflicto={wizard.idsConProblema.includes(integrante.id)}
                enEdicion={wizard.editandoId === integrante.id}
                onEditar={() => wizard.iniciarEdicion(integrante.id)}
                onEliminar={() => wizard.eliminarIntegrante(integrante.id)}
              />
            ))}
          </ul>
        )}

        {wizard.integrantes.length > 0 &&
          !wizard.integrantes.some((integrante) => integrante.isCaptain) && (
            <p className="text-xs text-primary-600 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 flex-shrink-0" aria-hidden="true" />
              Todavía no marcaste capitán. No es obligatorio, pero conviene dejarlo asentado.
            </p>
          )}
      </div>

      <RosterMemberForm
        editando={editando}
        requerido={plantelRequerido}
        lugarTitular={hayLugar(wizard.integrantes, plantelRequerido, false)}
        lugarSuplente={hayLugar(wizard.integrantes, plantelRequerido, true)}
        departamentoEquipo={wizard.equipo.department}
        localidadEquipo={wizard.equipo.locality}
        onGuardar={wizard.agregarIntegrante}
        onCancelarEdicion={wizard.cancelarEdicion}
      />

      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={wizard.volverASeleccion}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-primary-600 hover:text-primary-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden="true" />
          Volver a la disciplina
        </button>

        <button
          type="button"
          onClick={wizard.irAConfirmacion}
          disabled={!wizard.completo}
          className="inline-flex items-center gap-2 px-7 py-3 rounded-xl text-sm font-bold text-white bg-primary-800 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed shadow-md transition-all"
        >
          Revisar el plantel
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
