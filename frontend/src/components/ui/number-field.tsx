import * as React from "react"
import { MinusIcon, PlusIcon } from "lucide-react"

import { cn } from "@/lib/utils"

interface NumberFieldProps
  extends Omit<
    React.ComponentProps<"input">,
    "type" | "value" | "defaultValue" | "onChange" | "min" | "max" | "step" | "size" | "inputMode"
  > {
  /** Valor numérico (o vacío). Siempre un `number`, nunca un string. */
  value?: number | null
  /** Se llama con el número, o con `undefined` si el campo queda vacío o incompleto. */
  onValueChange?: (value: number | undefined) => void
  min?: number
  max?: number
  /** Salto de los botones y de las flechas del teclado. Por defecto 1. */
  step?: number
  /** Admite decimales (coma o punto). Por defecto sólo enteros. */
  decimal?: boolean
  /** Muestra los botones − / +. Por defecto sí. */
  stepper?: boolean
  /**
   * Al salir del campo, acota lo tipeado a `min`/`max` y, si quedó vacío, vuelve
   * al último valor. Para campos que siempre necesitan un valor (p. ej. la hora).
   */
  clampOnBlur?: boolean
  /** Prefijo de los nombres accesibles de los botones ("Disminuir"/"Aumentar" + etiqueta). */
  stepLabel?: string
  /** Clases del contenedor. */
  wrapperClassName?: string
}

function decimalsOf(n: number): number {
  const text = String(n)
  const dot = text.indexOf(".")
  return dot === -1 ? 0 : text.length - dot - 1
}

function formatNumber(n: number | null | undefined): string {
  return typeof n === "number" && Number.isFinite(n) ? String(n) : ""
}

function parseDraft(draft: string): number | undefined {
  if (draft === "" || draft === "-" || draft === "." || draft === "-.") return undefined
  const n = Number(draft)
  return Number.isFinite(n) ? n : undefined
}

function clamp(n: number, min?: number, max?: number): number {
  let out = n
  if (min !== undefined && out < min) out = min
  if (max !== undefined && out > max) out = max
  return out
}

const STEP_BUTTON =
  "inline-flex w-9 shrink-0 cursor-pointer items-center justify-center text-primary-600 outline-none transition-colors duration-120 motion-reduce:transition-none hover:bg-primary-50 hover:text-primary-900 active:bg-primary-100 focus-visible:bg-primary-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent pointer-coarse:w-11"

/**
 * Campo numérico propio (reemplaza `<input type="number">`): texto con teclado
 * numérico, botones − / + y flechas ↑ ↓ (Mayús = ×10), sin el spinner nativo.
 * Los límites `min`/`max` acotan los botones y las flechas; lo que se tipea
 * no se recorta, así la validación del formulario sigue mostrando el error.
 *
 * Con react-hook-form:
 * `<NumberField value={field.value} onValueChange={field.onChange}
 *    onBlur={field.onBlur} name={field.name} ref={field.ref} />`
 */
function NumberField({
  value,
  onValueChange,
  min,
  max,
  step = 1,
  decimal = false,
  stepper = true,
  stepLabel,
  clampOnBlur = false,
  wrapperClassName,
  className,
  disabled,
  readOnly,
  onBlur,
  onKeyDown,
  ref,
  ...props
}: NumberFieldProps) {
  const [draft, setDraft] = React.useState(() => formatNumber(value))

  // Si el valor cambia desde afuera (reset del formulario, carga de datos),
  // el texto lo sigue; mientras se tipea, el borrador manda.
  React.useEffect(() => {
    const external = typeof value === "number" && Number.isFinite(value) ? value : undefined
    setDraft((current) => (parseDraft(current) === external ? current : formatNumber(external)))
  }, [value])

  const allowNegative = min === undefined || min < 0
  const pattern = decimal
    ? allowNegative
      ? /^-?\d*\.?\d*$/
      : /^\d*\.?\d*$/
    : allowNegative
      ? /^-?\d*$/
      : /^\d*$/

  const current = parseDraft(draft)

  const commit = (next: number | undefined, text: string) => {
    setDraft(text)
    onValueChange?.(next)
  }

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const text = event.target.value.replace(",", ".").replace(/\s/g, "")
    if (!pattern.test(text)) return
    commit(parseDraft(text), text)
  }

  const stepBy = (direction: 1 | -1, multiplier = 1) => {
    if (disabled || readOnly) return
    const base = current ?? (min !== undefined ? min : 0)
    const raw = current === undefined ? base : base + direction * step * multiplier
    const precision = Math.max(decimalsOf(step), decimalsOf(base))
    const next = clamp(Number(raw.toFixed(precision)), min, max)
    commit(next, formatNumber(next))
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    onKeyDown?.(event)
    if (event.defaultPrevented) return
    if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault()
      stepBy(event.key === "ArrowUp" ? 1 : -1, event.shiftKey ? 10 : 1)
    } else if (event.key === "Home" && min !== undefined && !readOnly && !disabled) {
      event.preventDefault()
      commit(min, formatNumber(min))
    } else if (event.key === "End" && max !== undefined && !readOnly && !disabled) {
      event.preventDefault()
      commit(max, formatNumber(max))
    }
  }

  const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    const parsed = parseDraft(draft)
    if (clampOnBlur) {
      if (parsed === undefined) {
        setDraft(formatNumber(value))
      } else {
        const bounded = clamp(parsed, min, max)
        commit(bounded, formatNumber(bounded))
      }
    } else {
      // "5." o "-" a medias: se normaliza (o se vacía) al salir del campo.
      setDraft(formatNumber(parsed))
    }
    onBlur?.(event)
  }

  const atMin = current !== undefined && min !== undefined && current <= min
  const atMax = current !== undefined && max !== undefined && current >= max
  const buttonSuffix = stepLabel ? ` ${stepLabel}` : ""

  return (
    <div
      data-slot="number-field"
      className={cn(
        "flex h-9 w-full min-w-0 items-stretch overflow-hidden rounded-md border border-input bg-transparent shadow-xs transition-colors duration-120 motion-reduce:transition-none pointer-coarse:h-11",
        "hover:border-primary-300 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50",
        "has-[input[aria-invalid=true]]:border-destructive has-[input[aria-invalid=true]]:ring-destructive/20",
        disabled && "cursor-not-allowed opacity-50 hover:border-input",
        wrapperClassName
      )}
    >
      {stepper && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Disminuir${buttonSuffix}`}
          disabled={disabled || readOnly || atMin}
          onClick={() => stepBy(-1)}
          className={cn(STEP_BUTTON, "border-r border-primary-100")}
        >
          <MinusIcon className="size-4" aria-hidden="true" />
        </button>
      )}
      <input
        ref={ref}
        type="text"
        role="spinbutton"
        inputMode={allowNegative && decimal ? "text" : decimal ? "decimal" : "numeric"}
        autoComplete="off"
        spellCheck={false}
        aria-valuenow={current}
        aria-valuemin={min}
        aria-valuemax={max}
        value={draft}
        disabled={disabled}
        readOnly={readOnly}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        data-slot="input"
        className={cn(
          "h-full min-w-0 flex-1 bg-transparent px-3 text-base tabular-nums outline-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed md:text-sm",
          stepper && "text-center",
          className
        )}
        {...props}
      />
      {stepper && (
        <button
          type="button"
          tabIndex={-1}
          aria-label={`Aumentar${buttonSuffix}`}
          disabled={disabled || readOnly || atMax}
          onClick={() => stepBy(1)}
          className={cn(STEP_BUTTON, "border-l border-primary-100")}
        >
          <PlusIcon className="size-4" aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export { NumberField }
export type { NumberFieldProps }
