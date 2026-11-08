import * as React from "react"
import { RadioGroup as RadioGroupPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

/**
 * Grupo de opciones excluyentes (reemplaza `<input type="radio">`).
 * Controlado: `value` + `onValueChange(string)`. Con react-hook-form:
 * `<RadioGroup value={field.value} onValueChange={field.onChange}>`.
 * Las flechas mueven la selección (roving focus de Radix).
 */
function RadioGroup({
  className,
  ...props
}: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
  return (
    <RadioGroupPrimitive.Root
      data-slot="radio-group"
      className={cn("grid gap-2", className)}
      {...props}
    />
  )
}

interface RadioItemProps
  extends Omit<React.ComponentProps<typeof RadioGroupPrimitive.Item>, "children"> {
  label?: React.ReactNode
  description?: React.ReactNode
  wrapperClassName?: string
  labelClassName?: string
}

function RadioItem({
  className,
  label,
  description,
  wrapperClassName,
  labelClassName,
  id,
  ...props
}: RadioItemProps) {
  const autoId = React.useId()
  const controlId = id ?? autoId
  const descriptionId = `${controlId}-desc`

  const control = (
    <RadioGroupPrimitive.Item
      data-slot="radio-item"
      id={controlId}
      aria-describedby={
        props["aria-describedby"] ?? (description ? descriptionId : undefined)
      }
      className={cn(
        "relative inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded-full border border-primary-300 bg-white shadow-2xs outline-none transition-colors duration-120 motion-reduce:transition-none",
        "hover:border-primary-500 hover:bg-primary-50",
        "focus-visible:border-primary-500 focus-visible:ring-[3px] focus-visible:ring-primary-500/40",
        "data-[state=checked]:border-primary-600",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-primary-300 disabled:hover:bg-white",
        "pointer-coarse:before:absolute pointer-coarse:before:-inset-3",
        className
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="block size-2.5 rounded-full bg-primary-600" />
    </RadioGroupPrimitive.Item>
  )

  if (label === undefined) return control

  return (
    <div
      className={cn(
        "flex items-start gap-3 pointer-coarse:min-h-11 pointer-coarse:items-center",
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

export { RadioGroup, RadioItem }
export type { RadioItemProps }
