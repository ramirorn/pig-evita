import {
  findDuplicates,
  RosterMember,
  rosterConsistencyError,
  rosterSizeError,
  splitRoster,
} from './roster-rules';

const member = (
  dni: string,
  over: Partial<RosterMember> = {},
): RosterMember => ({
  dni,
  isSubstitute: false,
  ...over,
});

/** `n` titulares y `s` suplentes con DNI distintos. */
const roster = (n: number, s: number): RosterMember[] => [
  ...Array.from({ length: n }, (_, i) => member(`1${i}`)),
  ...Array.from({ length: s }, (_, i) =>
    member(`2${i}`, { isSubstitute: true }),
  ),
];

const FUTBOL = { name: 'Fútbol 11', starters: 11, maxSubstitutes: 5 };

describe('findDuplicates', () => {
  it('devuelve cada valor repetido una sola vez', () => {
    expect(findDuplicates(['a', 'b', 'a', 'c', 'a', 'b'])).toEqual(['a', 'b']);
  });

  it('lista vacía si no hay repetidos', () => {
    expect(findDuplicates(['a', 'b', 'c'])).toEqual([]);
  });
});

describe('splitRoster', () => {
  it('separa titulares y suplentes respetando el orden', () => {
    const { starters, substitutes } = splitRoster([
      member('1'),
      member('2', { isSubstitute: true }),
      member('3'),
    ]);
    expect(starters.map((m) => m.dni)).toEqual(['1', '3']);
    expect(substitutes.map((m) => m.dni)).toEqual(['2']);
  });
});

describe('rosterConsistencyError', () => {
  it('null para un plantel consistente', () => {
    expect(rosterConsistencyError(roster(11, 3))).toBeNull();
  });

  it('DNI repetidos', () => {
    expect(
      rosterConsistencyError([member('48100001'), member('48100001')]),
    ).toBe(
      'El plantel tiene DNI repetidos: 48100001. ' +
        'Cada integrante tiene que figurar una sola vez.',
    );
  });

  it('más de un capitán', () => {
    expect(
      rosterConsistencyError([
        member('1', { isCaptain: true }),
        member('2', { isCaptain: true }),
      ]),
    ).toBe(
      'El plantel tiene 2 capitanes marcados. Como mucho puede haber uno.',
    );
  });

  it('los DNI repetidos se informan antes que los capitanes', () => {
    expect(
      rosterConsistencyError([
        member('1', { isCaptain: true }),
        member('1', { isCaptain: true }),
      ]),
    ).toMatch(/DNI repetidos/);
  });
});

describe('rosterSizeError', () => {
  it('null con los titulares exactos y suplentes hasta el máximo', () => {
    expect(rosterSizeError(roster(11, 0), FUTBOL)).toBeNull();
    expect(rosterSizeError(roster(11, 5), FUTBOL)).toBeNull();
  });

  it('titulares de menos o de más', () => {
    expect(rosterSizeError(roster(10, 3), FUTBOL)).toBe(
      '"Fútbol 11" exige exactamente 11 titulares y el plantel trae 10.',
    );
    expect(rosterSizeError(roster(12, 3), FUTBOL)).toMatch(/trae 12/);
  });

  it('suplentes por encima del máximo', () => {
    expect(rosterSizeError(roster(11, 6), FUTBOL)).toBe(
      '"Fútbol 11" admite hasta 5 suplentes y el plantel trae 6.',
    );
  });
});
