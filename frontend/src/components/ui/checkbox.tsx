import * as React from "react"
import { CheckIcon, MinusIcon } from "lucide-react"
import { Checkbox as CheckboxPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

interface CheckboxProps
  extends Omit<
    React.ComponentProps<typeof CheckboxPrimitive.Root>,
    "checked" | "onCheckedChange" | "children"
  > {
  checked?: boolean
  /** Estado mixto (p. ej. "seleccionar todos" con una parte marcada). */
  indeterminate?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Texto clickeable al lado de la casilla. */
  label?: React.ReactNode
  /** Aclaración más chica debajo del label. */
  description?: React.ReactNode
  /** Clases del contenedor cuando hay label. */
  wrapperClassName?: string
  /** Clases del texto del label. */
  labelClassName?: string
}

/**
 * Casilla propia (reemplaza `<input type="checkbox">`). Controlada:
 * `checked` + `onCheckedChange(boolean)`. Con react-hook-form:
 * `<Checkbox checked={field.value} onCheckedChange={field.onChange} />`.
 * Dentro de `FormControl` recibe `id` y los `aria-*` por Slot.
 */
function Checkbox({
  className,
  checked = false,
  indeterminate = false,
  onCheckedChange,
  label,
  description,
  wrapperClassName,
  labelClassName,
  id,
  ...props
}: CheckboxProps) {
  const autoId = React.useId()
  const controlId = id ?? autoId
  const descriptionId = `${controlId}-desc`

  const control = (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      id={controlId}
      checked={indeterminate ? "indeterminate" : checked}
      onCheckedChange={(next) => onCheckedChange?.(next === true)}
      aria-describedby={
        props["aria-describedby"] ?? (description ? descriptionId : undefined)
      }
      className={cn(
        "relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-md border border-primary-300 bg-white text-white shadow-2xs outline-none transition-colors duration-120 motion-reduce:transition-none",
        "hover:border-primary-500 hover:bg-primary-50",
        "focus-visible:border-primary-500 focus-visible:ring-[3px] focus-visible:ring-primary-500/40",
        "data-[state=checked]:border-primary-600 data-[state=checked]:bg-primary-600 data-[state=checked]:hover:bg-primary-700",
        "data-[state=indeterminate]:border-primary-600 data-[state=indeterminate]:bg-primary-600 data-[state=indeterminate]:hover:bg-primary-700",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-primary-300 disabled:hover:bg-white",
        // Área táctil de 44 px sin agrandar la casilla.
        "pointer-coarse:before:absolute pointer-coarse:before:-inset-3",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center">
        {indeterminate ? (
          <MinusIcon className="size-3.5" strokeWidth={3} aria-hidden="true" />
        ) : (
          <CheckIcon className="size-3.5" strokeWidth={3} aria-hidden="true" />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )

  if (label === undefined) return control

  return (
    <div
      className={cn(
        "inline-flex items-start gap-3 pointer-coarse:min-h-11 pointer-coarse:items-center",
        wrapperClassName
      )}
    >
      <span className="mt-0.5 inline-flex pointer-coarse:mt-0">{control}</span>
      <div className="min-w-0">
        <label
          htmlFor={controlId}
          className={cn(
            "cursor-pointer text-sm leading-snug font-medium text-primary-900 select-none",
            props.disabled && "cursor-not-allowed opacity-50",
            labelClassName
          )}
        >
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="mt-0.5 text-xs leading-snug text-primary-600">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { Checkbox }
export type { CheckboxProps }
