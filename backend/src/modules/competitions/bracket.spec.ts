// ===========================================
// Llave y grupos (F-14) — funciones puras de emparejamiento
// ===========================================
import {
  crucesFaseDeGrupos,
  crucesTodosContraTodos,
  ordenDeSiembra,
  primeraRondaEliminacion,
  repartirEnGrupos,
  siguienteRondaEliminacion,
  PartidoDeLlave,
} from './bracket';

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i + 1}`);

describe('ordenDeSiembra', () => {
  it('el 1 y el 2 quedan en mitades opuestas', () => {
    expect(ordenDeSiembra(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(ordenDeSiembra(2)).toEqual([1, 2]);
  });
});

describe('primeraRondaEliminacion', () => {
  it('potencia de 2: sin byes, cada uno juega una vez', () => {
    const cruces = primeraRondaEliminacion(ids(4));
    expect(cruces).toEqual([
      { round: 1, matchNumber: 1, homeId: 'p1', awayId: 'p4' },
      { round: 1, matchNumber: 2, homeId: 'p2', awayId: 'p3' },
    ]);
  });

  it('con 5: llave de 8, los 3 mejores sembrados pasan directo', () => {
    const cruces = primeraRondaEliminacion(ids(5));
    expect(cruces).toHaveLength(4);
    const byes = cruces.filter((c) => c.awayId === null).map((c) => c.homeId);
    expect(byes.sort()).toEqual(['p1', 'p2', 'p3']);
    expect(cruces.find((c) => c.awayId !== null)).toMatchObject({
      homeId: 'p4',
      awayId: 'p5',
    });
  });

  it('no muta la entrada', () => {
    const entrada = ids(3);
    primeraRondaEliminacion(entrada);
    expect(entrada).toEqual(['p1', 'p2', 'p3']);
  });
});

describe('siguienteRondaEliminacion', () => {
  const partido = (
    matchNumber: number,
    ganador: string,
    perdedor: string | null,
    status = 'FINALIZADO',
  ): PartidoDeLlave => ({
    round: 1,
    matchNumber,
    status,
    results: [
      { teamId: null, participantId: ganador, isWinner: true },
      ...(perdedor
        ? [{ teamId: null, participantId: perdedor, isWinner: false }]
        : []),
    ],
  });

  it('con la ronda completa cruza al ganador del 2k-1 con el del 2k', () => {
    const siguiente = siguienteRondaEliminacion([
      partido(1, 'p1', null), // bye
      partido(2, 'p5', 'p4'),
      partido(3, 'p2', null),
      partido(4, 'p3', null),
    ]);
    expect(siguiente).toEqual({
      tipo: 'participant',
      cruces: [
        { round: 2, matchNumber: 1, homeId: 'p1', awayId: 'p5' },
        { round: 2, matchNumber: 2, homeId: 'p2', awayId: 'p3' },
      ],
    });
  });

  it('con un partido sin terminar todavía no arma nada', () => {
    expect(
      siguienteRondaEliminacion([
        partido(1, 'p1', 'p4'),
        partido(2, 'p2', 'p3', 'PROGRAMADO'),
      ]),
    ).toBeNull();
  });

  it('la final terminada no genera otra ronda', () => {
    expect(siguienteRondaEliminacion([partido(1, 'p1', 'p2')])).toBeNull();
  });
});

describe('fase de grupos', () => {
  it.each([
    [2, [2]],
    [4, [4]],
    [5, [5]],
    [6, [3, 3]],
    [8, [4, 4]],
    [12, [4, 4, 4]],
    [13, [4, 3, 3, 3]],
  ])('%i competidores → grupos %j', (n, tamanos) => {
    expect(repartirEnGrupos(ids(n)).map((g) => g.length)).toEqual(tamanos);
  });

  it('nadie juega contra alguien de otro grupo y dentro del grupo es todos contra todos', () => {
    const grupos = repartirEnGrupos(ids(8));
    const grupoDe = new Map(
      grupos.flatMap((g, i) => g.map((id) => [id, i] as const)),
    );
    const cruces = crucesFaseDeGrupos(ids(8));
    expect(cruces).toHaveLength(12); // 2 grupos × 6 cruces
    for (const c of cruces) {
      expect(grupoDe.get(c.homeId)).toBe(grupoDe.get(c.awayId!));
    }
    // numeración correlativa dentro de cada fecha
    for (const fecha of new Set(cruces.map((c) => c.round))) {
      const numeros = cruces
        .filter((c) => c.round === fecha)
        .map((c) => c.matchNumber);
      expect(numeros).toEqual(numeros.map((_, i) => i + 1));
    }
  });

  it('todos contra todos reusa el mismo emparejamiento del round robin', () => {
    expect(crucesTodosContraTodos(ids(4))).toHaveLength(6);
  });
});
