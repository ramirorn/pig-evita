// ===========================================
// @IsDni() — equivalencia con los decoradores inline previos (T24)
// ===========================================
import { PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, validateSync } from 'class-validator';
import { DNI_MESSAGES, DNI_REGEX, IsDni } from './dni.validator';

/** DTO nuevo: usa el decorador extraído. */
class ConIsDni {
  @IsDni()
  dni: string;
}

/**
 * DTO de control: réplica exacta de lo que había inline en
 * `inscriptions.dto.ts` y `participants.dto.ts` antes de T24. Existe para que
 * el test falle si el refactor cambia el comportamiento observable, que es la
 * condición de la tarea.
 */
class LegacyInline {
  @IsString()
  @IsNotEmpty({ message: 'El DNI es obligatorio' })
  @Matches(/^\d{7,8}$/, { message: 'El DNI debe tener 7 u 8 dígitos' })
  dni: string;
}

/** Simula un `UpdateXxxDto`, que hereda vía `PartialType()`. */
class ComoUpdateDto extends PartialType(ConIsDni) {}

/** Devuelve los mensajes de error de `dni`, ordenados para poder compararlos. */
function mensajes(Dto: new () => any, valor: unknown): string[] {
  const instancia = Object.assign(new Dto(), { dni: valor });
  const errores = validateSync(instancia, { whitelist: true });
  return errores
    .flatMap((e) => Object.values(e.constraints ?? {}))
    .sort() as string[];
}

const ACEPTADOS = ['1234567', '12345678', '0000000', '00000000', '99999999'];

const RECHAZADOS: Array<[string, unknown]> = [
  ['string vacío', ''],
  ['6 dígitos', '123456'],
  ['9 dígitos', '123456789'],
  ['con puntos', '12.345.678'],
  ['con espacios', ' 12345678 '],
  ['con letras', '1234567a'],
  ['number en vez de string', 12345678],
  ['undefined', undefined],
  ['null', null],
];

describe('@IsDni()', () => {
  describe('acepta los DNI que ya se aceptaban', () => {
    it.each(ACEPTADOS)('%s es válido', (valor) => {
      expect(mensajes(ConIsDni, valor)).toEqual([]);
    });
  });

  describe('rechaza lo que ya se rechazaba', () => {
    it.each(RECHAZADOS)('%s es inválido', (_caso, valor) => {
      expect(mensajes(ConIsDni, valor).length).toBeGreaterThan(0);
    });
  });

  describe('equivalencia exacta con los decoradores inline previos', () => {
    it.each([...ACEPTADOS.map((v) => [v, v] as const), ...RECHAZADOS])(
      'produce los mismos mensajes que el inline para %s',
      (_caso, valor) => {
        expect(mensajes(ConIsDni, valor)).toEqual(mensajes(LegacyInline, valor));
      },
    );
  });

  describe('mensajes visibles para el usuario final', () => {
    it('un DNI con formato incorrecto explica cuántos dígitos van', () => {
      expect(mensajes(ConIsDni, '123')).toContain(DNI_MESSAGES.formato);
    });

    it('un DNI vacío avisa que es obligatorio', () => {
      expect(mensajes(ConIsDni, '')).toContain(DNI_MESSAGES.requerido);
    });
  });

  describe('convive con PartialType() en los UpdateXxxDto', () => {
    it('permite omitir el dni en un update', () => {
      expect(validateSync(new ComoUpdateDto())).toEqual([]);
    });

    it('pero si el dni viene, sigue validando el formato', () => {
      expect(mensajes(ComoUpdateDto, '123')).toContain(DNI_MESSAGES.formato);
    });
  });
});

describe('DNI_REGEX', () => {
  it('es la única fuente de verdad del formato: 7 u 8 dígitos', () => {
    expect(DNI_REGEX.test('1234567')).toBe(true);
    expect(DNI_REGEX.test('12345678')).toBe(true);
    expect(DNI_REGEX.test('123456')).toBe(false);
    expect(DNI_REGEX.test('123456789')).toBe(false);
  });

  /**
   * Documenta el hueco que T15 va a cerrar del lado del cliente. Cuando esa
   * regla se agregue acá, este test tiene que invertirse — está escrito para
   * que nadie endurezca el backend sin darse cuenta de que cambió el contrato.
   */
  it('todavía acepta dígitos repetidos (pendiente de T15)', () => {
    expect(DNI_REGEX.test('00000000')).toBe(true);
    expect(DNI_REGEX.test('11111111')).toBe(true);
  });
});
