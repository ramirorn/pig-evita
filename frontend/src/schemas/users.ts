// ===========================================
// Schemas de usuarios
// ===========================================
import { z } from 'zod';
import { UserRole } from '@/types';
import { MAX_NOMBRE_PERSONA, MAX_NOMBRE_LUGAR, MAX_PASSWORD, textoObligatorio, textoOpcional, emailObligatorio } from './_helpers';

// ==========================================
// User Schemas
// ==========================================

// Contraseñas NUEVAS: mismo mínimo que el backend (`password-policy.ts`, VULN-23).
// El login sigue en 8 para que las cuentas existentes puedan entrar.
const MINIMO_CONTRASENA_NUEVA = 12;

export const createUserSchema = z.object({
  email: emailObligatorio(),
  password: z
    .string()
    .min(MINIMO_CONTRASENA_NUEVA, `La contraseña debe tener al menos ${MINIMO_CONTRASENA_NUEVA} caracteres`)
    .max(MAX_PASSWORD, `La contraseña no puede superar los ${MAX_PASSWORD} caracteres`),
  firstName: textoObligatorio(2, MAX_NOMBRE_PERSONA, 'El nombre es obligatorio', 'El nombre'),
  lastName: textoObligatorio(2, MAX_NOMBRE_PERSONA, 'El apellido es obligatorio', 'El apellido'),
  role: z.nativeEnum(UserRole, { message: 'Rol inválido' }),
  // Departamento y zona de asignación del usuario administrativo: texto libre
  // en Prisma (`department String?`) y sin catálogo cerrado en el frontend.
  department: textoOpcional(MAX_NOMBRE_LUGAR, 'El departamento'),
  zone: textoOpcional(MAX_NOMBRE_LUGAR, 'La zona'),
});

export const updateUserSchema = z.object({
  email: emailObligatorio(),
  // En edición el campo vacío significa "no cambiar la contraseña".
  password: z
    .string()
    .refine(
      (val) => !val || (val.length >= MINIMO_CONTRASENA_NUEVA && val.length <= MAX_PASSWORD),
      { message: `La nueva contraseña debe tener entre ${MINIMO_CONTRASENA_NUEVA} y ${MAX_PASSWORD} caracteres` },
    )
    .optional(),
  firstName: textoObligatorio(2, MAX_NOMBRE_PERSONA, 'El nombre es obligatorio', 'El nombre'),
  lastName: textoObligatorio(2, MAX_NOMBRE_PERSONA, 'El apellido es obligatorio', 'El apellido'),
  role: z.nativeEnum(UserRole, { message: 'Rol inválido' }),
  department: textoOpcional(MAX_NOMBRE_LUGAR, 'El departamento'),
  zone: textoOpcional(MAX_NOMBRE_LUGAR, 'La zona'),
  isActive: z.boolean().default(true),
});
