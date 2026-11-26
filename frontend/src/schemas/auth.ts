// ===========================================
// Schemas de autenticación
// ===========================================
import { z } from 'zod';
import { MAX_PASSWORD, emailObligatorio } from './_helpers';

// ==========================================
// Auth Schemas
// ==========================================

export const loginSchema = z.object({
  email: emailObligatorio(),
  // 8, no 6: `LoginDto` del backend exige `@MinLength(8)`. Con 6 el formulario
  // dejaba enviar una contraseña que el backend rechazaba con un 400.
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .max(MAX_PASSWORD, `La contraseña no puede superar los ${MAX_PASSWORD} caracteres`),
});
