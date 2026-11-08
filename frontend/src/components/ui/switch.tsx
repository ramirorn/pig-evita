import * as React from "react"
import { Switch as SwitchPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

interface SwitchProps
  extends Omit<
    React.ComponentProps<typeof SwitchPrimitive.Root>,
    "checked" | "onCheckedChange" | "children"
  > {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  /** Texto clickeable al lado del interruptor. */
  label?: React.ReactNode
  /** Aclaración más chica debajo del label. */
  description?: React.ReactNode
  wrapperClassName?: string
  labelClassName?: string
}

/**
 * Interruptor propio para ajustes de encendido/apagado ("Publicada",
 * "Activa"). Controlado: `checked` + `onCheckedChange(boolean)`. Con
 * react-hook-form: `<Switch checked={field.value} onCheckedChange={field.onChange} />`.
 * Usa `role="switch"` + `aria-checked`; Espacio lo alterna.
 */
function Switch({
  className,
  checked = false,
  onCheckedChange,
  label,
  description,
  wrapperClassName,
  labelClassName,
  id,
  ...props
}: SwitchProps) {
  const autoId = React.useId()
  const controlId = id ?? autoId
  const descriptionId = `${controlId}-desc`

  const control = (
    <SwitchPrimitive.Root
      data-slot="switch"
      id={controlId}
      checked={checked}
      onCheckedChange={onCheckedChange}
      aria-describedby={
        props["aria-describedby"] ?? (description ? descriptionId : undefined)
      }
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border border-primary-400 bg-primary-100 outline-none transition-colors duration-120 motion-reduce:transition-none",
        "hover:border-primary-500 hover:bg-primary-200",
        "focus-visible:ring-[3px] focus-visible:ring-primary-500/40",
        "data-[state=checked]:border-primary-600 data-[state=checked]:bg-primary-600 data-[state=checked]:hover:bg-primary-700",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20",
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-primary-100 disabled:data-[state=checked]:hover:bg-primary-600",
        // Área táctil de 44 px sin agrandar el interruptor.
        "pointer-coarse:before:absolute pointer-coarse:before:-inset-x-1 pointer-coarse:before:-inset-y-2.5",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          "pointer-events-none block size-4 translate-x-[3px] rounded-full bg-primary-500 shadow-xs transition-transform duration-120 motion-reduce:transition-none",
          "data-[state=checked]:translate-x-[23px] data-[state=checked]:bg-white"
        )}
      />
    </SwitchPrimitive.Root>
  )

  if (label === undefined) return control

  return (
    <div
      className={cn(
        "inline-flex items-start gap-3 pointer-coarse:min-h-11 pointer-coarse:items-center",
        wrapperClassName
      )}
    >
      {control}
      <div className="min-w-0">
        <label
          htmlFor={controlId}
          className={cn(
            "cursor-pointer text-sm leading-6 font-medium text-primary-900 select-none",
            props.disabled && "cursor-not-allowed opacity-50",
            labelClassName
          )}
        >
          {label}
        </label>
        {description ? (
          <p id={descriptionId} className="text-xs leading-snug text-primary-600">
            {description}
          </p>
        ) : null}
      </div>
    </div>
  )
}

export { Switch }
export type { SwitchProps }
