// ===========================================
// @Trim — recorte de espacios antes de validar (F-06 / F-07)
// ===========================================
//
// `@IsNotEmpty` sólo rechaza `''`: un motivo de rechazo `"   "` pasaba la
// validación y quedaba guardado como si fuera un motivo real. Recortando antes
// de validar, `"   "` llega como `''` y el `@IsNotEmpty` hace su trabajo.
// Los valores que no son string se dejan tal cual para que el `@IsString`
// correspondiente los rechace con su propio mensaje.
import { Transform } from 'class-transformer';

export function Trim(): PropertyDecorator {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
}
