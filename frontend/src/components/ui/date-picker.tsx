// ===========================================
// DatePicker — selector de fecha propio (familia de ClockTimePicker)
//
// - Valor: `YYYY-MM-DD` o `''`, igual que el campo de fecha nativo que
//   reemplaza; no cambia esquemas Zod ni payloads.
// - Campo de texto con máscara dd/mm/aaaa (rápido desde el celular) + botón
//   que abre un calendario en popover (Radix Popover, modal).
// - Patrón "date picker dialog" de WAI-ARIA: grilla con flechas, Inicio/Fin,
//   RePág/AvPág (Mayús = año), Enter/Espacio elige, Escape cierra y devuelve
//   el foco al botón.
// - Toda la lógica de fechas vive en `@/lib/datePicker` (sin React), que
//   ejercita `npm run check:pickers`.
// ===========================================
import * as React from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { Popover as PopoverPrimitive } from 'radix-ui';

import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { SelectField } from '@/components/ui/select';
import {
  DATE_TEXT_PLACEHOLDER,
  MONTH_NAMES_ES,
  WEEKDAY_NAMES_ES,
  WEEKDAY_SHORT_ES,
  addMonths,
  clampIso,
  dateTextError,
  formatDateText,
  formatLongEs,
  formatMonthYearEs,
  initialFocusDate,
  isGridKey,
  isInRange,
  maskDateText,
  monthGrid,
  monthHasSelectableDays,
  nextFocusDate,
  parseDateText,
  parseIso,
  todayIso,
  withMonthYear,
  yearOptions,
  type IsoDate,
} from '@/lib/datePicker';

export interface DatePickerProps {
  /** `YYYY-MM-DD` o vacío. */
  value?: string | null;
  /** Recibe `YYYY-MM-DD`, o `''` mientras el texto no sea una fecha válida. */
  onChange: (value: string) => void;
  onBlur?: () => void;
  name?: string;
  id?: string;
  /** Fecha mínima elegible (`YYYY-MM-DD`). */
  min?: string;
  /** Fecha máxima elegible (`YYYY-MM-DD`). */
  max?: string;
  disabled?: boolean;
  required?: boolean;
  /** Clases del campo de texto (alto, borde, radio). */
  className?: string;
  /** Clases del contenedor (ancho, márgenes). */
  wrapperClassName?: string;
  /** Texto del botón del calendario para lectores de pantalla. */
  pickerLabel?: string;
  ref?: React.Ref<HTMLInputElement>;
  'aria-label'?: string;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}

export function DatePicker({
  value,
  onChange,
  onBlur,
  name,
  id,
  min,
  max,
  disabled = false,
  required = false,
  className,
  wrapperClassName,
  pickerLabel = 'Elegir fecha',
  ref,
  'aria-describedby': describedBy,
  'aria-invalid': ariaInvalid,
  ...aria
}: DatePickerProps) {
  const current = value ?? '';
  const autoId = React.useId();
  const inputId = id ?? `${autoId}-input`;
  const hintId = `${autoId}-hint`;
  const errorId = `${autoId}-error`;

  const [text, setText] = React.useState(() => formatDateText(current));
  const [showError, setShowError] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  // Último valor que emitió este campo: si el `value` cambia por otro lado
  // (reset del formulario, carga de datos), el texto se re-sincroniza.
  const [emitted, setEmitted] = React.useState(current);
  const [prevValue, setPrevValue] = React.useState(current);
  if (current !== prevValue) {
    setPrevValue(current);
    if (current !== emitted) {
      setEmitted(current);
      setText(formatDateText(current));
      setShowError(false);
    }
  }

  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const setInputRef = React.useCallback(
    (node: HTMLInputElement | null) => {
      inputRef.current = node;
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    },
    [ref],
  );

  const parsed = parseDateText(text);
  const errorMessage = dateTextError(parsed, min, max);
  const visibleError = showError ? errorMessage : null;

  // Los formularios con validación nativa (p. ej. la inscripción pública) no
  // se envían con una fecha imposible o fuera de rango escrita a mano.
  React.useEffect(() => {
    inputRef.current?.setCustomValidity(errorMessage ?? '');
  }, [errorMessage]);

  const emit = (next: string) => {
    setEmitted(next);
    if (next !== current) onChange(next);
  };

  const handleTextChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const masked = maskDateText(event.target.value);
    setText(masked);
    const result = parseDateText(masked);
    if (result.status === 'ok' && isInRange(result.iso, min, max)) {
      emit(result.iso);
    } else {
      emit('');
    }
    // El error se muestra apenas la fecha está completa; si está a medias,
    // recién al salir del campo, para no retar mientras se escribe.
    setShowError(result.status === 'ok' || result.status === 'invalid');
  };

  const handleSelect = (iso: IsoDate) => {
    setText(formatDateText(iso));
    setShowError(false);
    emit(iso);
    setOpen(false);
  };

  const handleClear = () => {
    setText('');
    setShowError(false);
    emit('');
    setOpen(false);
  };

  const describedByIds = [describedBy, hintId, visibleError ? errorId : null]
    .filter(Boolean)
    .join(' ');
  const invalid = ariaInvalid === true || ariaInvalid === 'true' || visibleError !== null;
  const selectedLabel = parseIso(current) ? formatLongEs(current) : null;

  return (
    <div data-slot="date-picker" className={cn('w-full', wrapperClassName)}>
      <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal>
        <PopoverPrimitive.Anchor asChild>
          <div className="relative">
            <Input
              ref={setInputRef}
              id={inputId}
              name={name}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder={DATE_TEXT_PLACEHOLDER}
              maxLength={10}
              value={text}
              onChange={handleTextChange}
              onBlur={() => {
                if (text !== '') setShowError(true);
                onBlur?.();
              }}
              disabled={disabled}
              required={required}
              aria-invalid={invalid}
              aria-describedby={describedByIds}
              {...aria}
              className={cn('h-11 pr-12 tabular-nums sm:h-9', className)}
            />
            <PopoverPrimitive.Trigger asChild>
              <button
                type="button"
                disabled={disabled}
                aria-label={selectedLabel ? `${pickerLabel}, elegida: ${selectedLabel}` : pickerLabel}
                className="absolute top-1/2 right-0 inline-flex size-11 -translate-y-1/2 cursor-pointer items-center justify-center rounded-lg text-primary-600 transition-colors outline-none hover:bg-primary-50 hover:text-primary-800 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 sm:size-9"
              >
                <CalendarDays className="size-4.5" aria-hidden="true" />
              </button>
            </PopoverPrimitive.Trigger>
          </div>
        </PopoverPrimitive.Anchor>

        <PopoverPrimitive.Portal>
          <PopoverPrimitive.Content
            align="end"
            sideOffset={6}
            collisionPadding={12}
            aria-label="Calendario"
            onOpenAutoFocus={(event) => event.preventDefault()}
            className="z-50 w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-primary-200 bg-surface-elevated p-3 text-primary-900 shadow-2xl outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <CalendarPanel
              value={current}
              min={min}
              max={max}
              required={required}
              onSelect={handleSelect}
              onClear={handleClear}
              onClose={() => setOpen(false)}
            />
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      <span id={hintId} className="sr-only">
        Formato día, mes y año: {DATE_TEXT_PLACEHOLDER}.
      </span>
      {visibleError && (
        <p id={errorId} role="alert" className="mt-1.5 text-xs font-medium text-destructive-600">
          {visibleError}
        </p>
      )}
    </div>
  );
}

// -------------------------------------------------
// Calendario del popover
// -------------------------------------------------

interface CalendarPanelProps {
  value: string;
  min?: string;
  max?: string;
  required: boolean;
  onSelect: (iso: IsoDate) => void;
  onClear: () => void;
  onClose: () => void;
}

const NAV_BUTTON =
  'inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-primary-700 transition-colors outline-none hover:bg-primary-50 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 sm:size-9';

const FOOTER_BUTTON =
  'inline-flex h-11 cursor-pointer items-center rounded-lg px-3 text-xs font-bold text-primary-700 transition-colors outline-none hover:bg-primary-50 focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-40 sm:h-8';

function CalendarPanel({ value, min, max, required, onSelect, onClear, onClose }: CalendarPanelProps) {
  const today = todayIso();
  // Se calcula una sola vez al montar: el popover se monta en cada apertura.
  const [focused, setFocused] = React.useState(() => initialFocusDate(value, { min, max, today }));
  const gridRef = React.useRef<HTMLTableElement>(null);
  const focusGrid = React.useRef(true);
  const headingId = React.useId();

  const focusedParts = parseIso(focused);
  const viewYear = focusedParts?.year ?? new Date().getFullYear();
  const viewMonth = focusedParts?.month ?? 1;

  React.useEffect(() => {
    if (!focusGrid.current) return;
    focusGrid.current = false;
    gridRef.current
      ?.querySelector<HTMLButtonElement>(`button[data-iso="${focused}"]`)
      ?.focus({ preventScroll: true });
  }, [focused]);

  const moveTo = (iso: IsoDate, moveFocus: boolean) => {
    focusGrid.current = moveFocus;
    setFocused(clampIso(iso, min, max));
  };

  const prevMonth = addMonths(focused, -1);
  const nextMonth = addMonths(focused, 1);
  const prevParts = parseIso(prevMonth);
  const nextParts = parseIso(nextMonth);
  const canPrev = prevParts ? monthHasSelectableDays(prevParts.year, prevParts.month, min, max) : false;
  const canNext = nextParts ? monthHasSelectableDays(nextParts.year, nextParts.month, min, max) : false;

  const monthOptions = MONTH_NAMES_ES.map((name, index) => ({
    value: String(index + 1),
    label: name.charAt(0).toUpperCase() + name.slice(1),
    disabled: !monthHasSelectableDays(viewYear, index + 1, min, max),
  }));
  const years = yearOptions(viewYear, { min, max, today }).map((year) => ({
    value: String(year),
    label: String(year),
    disabled: !isYearPartlyInRange(year, min, max),
  }));

  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
    if (!isGridKey(event.key)) return;
    event.preventDefault();
    moveTo(nextFocusDate(focused, event.key, { shift: event.shiftKey, min, max }), true);
  };

  const weeks = monthGrid(viewYear, viewMonth);
  const canPickToday = isInRange(today, min, max);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1">
        <button
          type="button"
          className={NAV_BUTTON}
          onClick={() => moveTo(prevMonth, false)}
          disabled={!canPrev}
          aria-label="Mes anterior"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <SelectField
          aria-label="Mes"
          size="lg"
          value={String(viewMonth)}
          onValueChange={(month) => moveTo(withMonthYear(focused, viewYear, Number(month)), false)}
          options={monthOptions}
          className="min-w-0 flex-1 px-2 font-semibold sm:h-9"
        />
        <SelectField
          aria-label="Año"
          size="lg"
          value={String(viewYear)}
          onValueChange={(year) => moveTo(withMonthYear(focused, Number(year), viewMonth), false)}
          options={years}
          className="w-[5.75rem] shrink-0 px-2 font-semibold tabular-nums sm:h-9"
        />
        <button
          type="button"
          className={NAV_BUTTON}
          onClick={() => moveTo(nextMonth, false)}
          disabled={!canNext}
          aria-label="Mes siguiente"
        >
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>

      <h2 id={headingId} aria-live="polite" className="sr-only">
        {formatMonthYearEs(viewYear, viewMonth)}
      </h2>

      <table
        ref={gridRef}
        role="grid"
        aria-labelledby={headingId}
        onKeyDown={handleGridKeyDown}
        className="w-full border-collapse"
      >
        <thead>
          <tr>
            {WEEKDAY_SHORT_ES.map((short, index) => (
              <th
                key={short}
                scope="col"
                className="pb-1 text-center text-[11px] font-bold tracking-wider text-primary-500 uppercase"
              >
                <span aria-hidden="true">{short}</span>
                <span className="sr-only">{WEEKDAY_NAMES_ES[index]}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((iso, dayIndex) => {
                if (!iso) return <td key={`vacio-${dayIndex}`} role="gridcell" />;
                const isSelected = iso === value;
                const isToday = iso === today;
                const isDisabled = !isInRange(iso, min, max);
                const isFocused = iso === focused;
                return (
                  <td key={iso} role="gridcell" aria-selected={isSelected} className="p-0.5 text-center">
                    <button
                      type="button"
                      data-iso={iso}
                      tabIndex={isFocused ? 0 : -1}
                      aria-label={formatLongEs(iso)}
                      aria-current={isToday ? 'date' : undefined}
                      aria-disabled={isDisabled || undefined}
                      onClick={() => {
                        if (!isDisabled) onSelect(iso);
                      }}
                      onFocus={() => {
                        if (!isFocused) setFocused(iso);
                      }}
                      className={cn(
                        'mx-auto inline-flex size-11 cursor-pointer items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-primary-500/50 sm:size-10',
                        !isSelected && !isDisabled && 'text-primary-900 hover:bg-primary-50',
                        isToday && !isSelected && 'ring-1 ring-accent-500 text-accent-800',
                        isSelected && 'bg-primary-600 text-white shadow-sm hover:bg-primary-700',
                        isDisabled && 'cursor-not-allowed text-primary-300 line-through decoration-primary-200',
                      )}
                    >
                      {Number(iso.slice(8, 10))}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="flex items-center justify-between gap-2 border-t border-primary-100 pt-2">
        <button
          type="button"
          className={FOOTER_BUTTON}
          onClick={() => onSelect(today)}
          disabled={!canPickToday}
        >
          Hoy
        </button>
        <div className="flex items-center gap-1">
          {!required && value !== '' && (
            <button type="button" className={FOOTER_BUTTON} onClick={onClear}>
              Borrar
            </button>
          )}
          <button type="button" className={FOOTER_BUTTON} onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/** ¿El año tiene algún mes elegible? (para deshabilitar años fuera de rango). */
function isYearPartlyInRange(year: number, min?: string, max?: string): boolean {
  for (let month = 1; month <= 12; month++) {
    if (monthHasSelectableDays(year, month, min, max)) return true;
  }
  return false;
}
