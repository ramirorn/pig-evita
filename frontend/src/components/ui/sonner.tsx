import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react"
import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      richColors
      closeButton
      duration={5000}
      toastOptions={{
        closeButtonAriaLabel: "Cerrar aviso",
        classNames: { toast: "font-sans text-sm" },
      }}
      containerAriaLabel="Notificaciones"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      // Los tokens del tema se llaman `--color-*` (ver `@theme` en index.css).
      // Con los nombres del template de shadcn (`--popover`, `--border`,
      // `--radius`), que acá no existen, el fondo de los avisos neutros
      // (cargando, info) quedaba transparente sobre el contenido.
      style={
        {
          "--normal-bg": "var(--color-popover)",
          "--normal-text": "var(--color-popover-foreground)",
          "--normal-border": "var(--color-primary-100)",
          "--border-radius": "var(--radius-lg)",
          // richColors mapeado a los tokens semánticos (texto 800 sobre fondo 50: AA).
          "--success-bg": "var(--color-success-50)",
          "--success-text": "var(--color-success-800)",
          "--success-border": "var(--color-success-200)",
          "--warning-bg": "var(--color-warning-50)",
          "--warning-text": "var(--color-warning-800)",
          "--warning-border": "var(--color-warning-200)",
          "--error-bg": "var(--color-destructive-50)",
          "--error-text": "var(--color-destructive-700)",
          "--error-border": "var(--color-destructive-500)",
          "--info-bg": "var(--color-primary-50)",
          "--info-text": "var(--color-primary-800)",
          "--info-border": "var(--color-primary-200)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
