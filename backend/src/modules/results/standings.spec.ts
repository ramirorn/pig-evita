// ===========================================
// Tabla de posiciones (F-12) — desenlace y orden
// ===========================================
import {
  FilaDeTabla,
  compararFilas,
  desenlaces,
  gruposDelFixture,
  ResultadoDeTabla,
} from './standings';

const r = (
  scoreData: unknown,
  isWinner: boolean | null = null,
  ranking: number | null = null,
): ResultadoDeTabla => ({
  teamId: null,
  participantId: 'x',
  isWinner,
  scoreData,
  ranking,
});

describe('desenlaces', () => {
  it('isWinner manda sobre el marcador', () => {
    expect(
      desenlaces([r({ goals: 0 }, true), r({ goals: 5 })], 'GOLES'),
    ).toEqual(['GANO', 'PERDIO']);
  });

  it('sin ganador marcado y marcador igual → empate', () => {
    expect(desenlaces([r({ goals: 1 }), r({ goals: 1 })], 'GOLES')).toEqual([
      'EMPATO',
      'EMPATO',
    ]);
  });

  it('sin ganador marcado ni marcador legible → empate, no derrota de los dos', () => {
    expect(desenlaces([r({}, false), r({}, false)], 'GOLES')).toEqual([
      'EMPATO',
      'EMPATO',
    ]);
    expect(desenlaces([r({}), r({})], undefined)).toEqual(['EMPATO', 'EMPATO']);
  });

  it('GOLES y PUNTOS: más es mejor', () => {
    expect(desenlaces([r({ goals: 1 }), r({ goals: 3 })], 'GOLES')).toEqual([
      'PERDIO',
      'GANO',
    ]);
    expect(desenlaces([r({ puntos: 2 }), r({ puntos: 1 })], 'PUNTOS')).toEqual([
      'GANO',
      'PERDIO',
    ]);
  });

  it('TIEMPO: menos es mejor, también en formato mm:ss', () => {
    expect(
      desenlaces([r({ time: '1:02.50' }), r({ time: '58.10' })], 'TIEMPO'),
    ).toEqual(['PERDIO', 'GANO']);
  });

  it('POSICIONES: el puesto más bajo gana, también desde la columna ranking', () => {
    expect(desenlaces([r({}, null, 2), r({}, null, 1)], 'POSICIONES')).toEqual([
      'PERDIO',
      'GANO',
    ]);
  });

  it('SETS con parciales: cuenta los sets ganados', () => {
    expect(
      desenlaces(
        [r({ sets: [25, 20, 25] }), r({ sets: [20, 25, 18] })],
        'SETS',
      ),
    ).toEqual(['GANO', 'PERDIO']);
  });
});

describe('compararFilas', () => {
  const fila = (over: Partial<FilaDeTabla>): FilaDeTabla => ({
    position: 0,
    id: over.name ?? 'x',
    name: 'x',
    teamId: null,
    participantId: null,
    played: 1,
    won: 0,
    drawn: 0,
    lost: 0,
    points: 0,
    scoreFor: 0,
    scoreAgainst: 0,
    ...over,
  });

  it('a igualdad de puntos desempata por diferencia cuando más es mejor', () => {
    const tabla = [
      fila({ name: 'A', points: 3, won: 1, scoreFor: 1, scoreAgainst: 0 }),
      fila({ name: 'B', points: 3, won: 1, scoreFor: 4, scoreAgainst: 0 }),
    ].sort(compararFilas('GOLES'));
    expect(tabla.map((f) => f.name)).toEqual(['B', 'A']);
  });

  it('en TIEMPO desempata el total más bajo', () => {
    const tabla = [
      fila({ name: 'A', points: 3, won: 1, scoreFor: 70 }),
      fila({ name: 'B', points: 3, won: 1, scoreFor: 60 }),
    ].sort(compararFilas('TIEMPO'));
    expect(tabla.map((f) => f.name)).toEqual(['B', 'A']);
  });
});

describe('gruposDelFixture', () => {
  const p = (a: string, b: string) => ({
    results: [
      { teamId: null, participantId: a },
      { teamId: null, participantId: b },
    ],
  });

  it('deduce los grupos de quién juega con quién, en orden de aparición', () => {
    const grupos = gruposDelFixture([
      p('a', 'b'),
      p('d', 'e'),
      p('b', 'c'),
      p('e', 'f'),
      p('a', 'c'),
    ]);
    expect([...grupos.entries()].sort()).toEqual([
      ['a', 'A'],
      ['b', 'A'],
      ['c', 'A'],
      ['d', 'B'],
      ['e', 'B'],
      ['f', 'B'],
    ]);
  });
});
