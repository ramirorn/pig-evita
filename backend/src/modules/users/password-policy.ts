// ===========================================
// Política de contraseñas nuevas (VULN-23)
// ===========================================
//
// Se aplica sólo a contraseñas NUEVAS (alta de usuario y cambio de
// contraseña). Las cuentas existentes siguen entrando con la que tienen: el
// login no la valida contra esta política, así nadie queda afuera al desplegar.
import { ValidateBy, type ValidationOptions } from 'class-validator';

/** Largo mínimo de una contraseña nueva. */
export const MINIMO_CONTRASENA = 12;

export const MENSAJE_LARGO_CONTRASENA = `La contraseña debe tener al menos ${MINIMO_CONTRASENA} caracteres`;

export const MENSAJE_CONTRASENA_COMUN =
  'La contraseña es demasiado común o fácil de adivinar: evitá palabras como "contraseña" o "evita", secuencias de teclado y números solos';

/**
 * Fragmentos que delatan una contraseña de diccionario o del propio sistema.
 * Se comparan contra la contraseña en minúsculas y sin tildes.
 */
const FRAGMENTOS_COMUNES = [
  'password',
  'contrasena',
  'juegosevita',
  'evita',
  'formosa',
  'admin',
  'qwerty',
  'asdfgh',
  'zxcvbn',
  '123456',
  'abcdef',
];

/** ¿La contraseña es de diccionario, una secuencia o un solo carácter repetido? */
export function esContrasenaComun(valor: string): boolean {
  const normal = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (/^(.)\1+$/.test(normal)) return true;
  if (/^\d+$/.test(normal)) return true;
  return FRAGMENTOS_COMUNES.some((f) => normal.includes(f));
}

/** Valida que una contraseña nueva no sea común (el largo lo valida `MinLength`). */
export function ContrasenaNoComun(opciones?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'contrasenaNoComun',
      validator: {
        validate: (valor: unknown) =>
          typeof valor === 'string' && !esContrasenaComun(valor),
        defaultMessage: () => MENSAJE_CONTRASENA_COMUN,
      },
    },
    opciones,
  );
}
