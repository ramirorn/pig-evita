import { AgeCriterion, Sex } from '@prisma/client';
import {
  EligibilityCategory,
  EligibilityPerson,
  individualEligibilityError,
  isSexAllowed,
  memberEligibilityError,
} from './inscription-eligibility';

const TODAY = new Date('2026-11-24T12:00:00Z');

const SUB_14_MASCULINO: EligibilityCategory = {
  name: 'Sub-14 Masculino',
  minAge: 12,
  maxAge: 14,
  sex: Sex.MASCULINO,
};

const NACIDOS_2012_2013_MIXTO: EligibilityCategory = {
  name: 'Nacidos 2012-2013',
  ageCriterion: AgeCriterion.BIRTH_YEAR,
  minAge: null,
  maxAge: null,
  minBirthYear: 2012,
  maxBirthYear: 2013,
  sex: Sex.MIXTO,
};

const person = (over: Partial<EligibilityPerson> = {}): EligibilityPerson => ({
  dni: '48100001',
  firstName: 'Juan',
  lastName: 'Pérez',
  birthDate: new Date('2013-01-01'),
  sex: Sex.MASCULINO,
  ...over,
});

describe('isSexAllowed', () => {
  it('una categoría MIXTO admite cualquier sexo', () => {
    expect(isSexAllowed(Sex.MIXTO, Sex.FEMENINO)).toBe(true);
    expect(isSexAllowed(Sex.MIXTO, Sex.MASCULINO)).toBe(true);
  });

  it('las demás sólo admiten el propio', () => {
    expect(isSexAllowed(Sex.MASCULINO, Sex.MASCULINO)).toBe(true);
    expect(isSexAllowed(Sex.MASCULINO, Sex.FEMENINO)).toBe(false);
  });
});

describe('individualEligibilityError', () => {
  it('null si la edad y el sexo entran', () => {
    expect(
      individualEligibilityError(
        SUB_14_MASCULINO,
        new Date('2013-01-01'),
        Sex.MASCULINO,
        TODAY,
      ),
    ).toBeNull();
  });

  it('en el límite de edad todavía entra (14 años cumplidos)', () => {
    expect(
      individualEligibilityError(
        SUB_14_MASCULINO,
        new Date('2012-01-01'),
        Sex.MASCULINO,
        TODAY,
      ),
    ).toBeNull();
  });

  it('fuera de rango: dice la edad y el rango admitido', () => {
    expect(
      individualEligibilityError(
        SUB_14_MASCULINO,
        new Date('2010-01-01'),
        Sex.MASCULINO,
        TODAY,
      ),
    ).toBe(
      'El participante tiene 16 años y la categoría admite de 12 a 14 años',
    );
  });

  it('sexo distinto: dice el sexo de la categoría', () => {
    expect(
      individualEligibilityError(
        SUB_14_MASCULINO,
        new Date('2013-01-01'),
        Sex.FEMENINO,
        TODAY,
      ),
    ).toBe('El sexo del participante no coincide con la categoría (MASCULINO)');
  });

  it('la edad se valida antes que el sexo', () => {
    expect(
      individualEligibilityError(
        SUB_14_MASCULINO,
        new Date('2000-01-01'),
        Sex.FEMENINO,
        TODAY,
      ),
    ).toMatch(/tiene 26 años/);
  });
});

describe('memberEligibilityError', () => {
  it('null si es elegible', () => {
    expect(
      memberEligibilityError(SUB_14_MASCULINO, person(), 'payload', TODAY),
    ).toBeNull();
  });

  it('nombra a la persona y la categoría', () => {
    expect(
      memberEligibilityError(
        SUB_14_MASCULINO,
        person({ birthDate: new Date('2010-01-01') }),
        'payload',
        TODAY,
      ),
    ).toBe(
      'Juan Pérez (DNI 48100001) tiene 16 años y la categoría ' +
        '"Sub-14 Masculino" admite de 12 a 14 años.',
    );
  });

  it('aclara cuando el dato sale del padrón', () => {
    expect(
      memberEligibilityError(
        SUB_14_MASCULINO,
        person({ sex: Sex.FEMENINO }),
        'registry',
        TODAY,
      ),
    ).toBe(
      'Juan Pérez (DNI 48100001) es FEMENINO según los datos cargados en el ' +
        'padrón y la categoría "Sub-14 Masculino" es MASCULINO.',
    );
  });

  it('categoría por año de nacimiento', () => {
    expect(
      memberEligibilityError(
        NACIDOS_2012_2013_MIXTO,
        person({ birthDate: new Date('2013-06-01'), sex: Sex.FEMENINO }),
        'payload',
        TODAY,
      ),
    ).toBeNull();
    expect(
      memberEligibilityError(
        NACIDOS_2012_2013_MIXTO,
        person({ birthDate: new Date('2014-06-01') }),
        'payload',
        TODAY,
      ),
    ).toMatch(/nació en 2014.*nacidos de 2012 a 2013/);
  });
});
