// ===========================================
// Métricas — protección por complemento y ranking de destacados
// ===========================================
//
// Un umbral por celda no alcanza si al lado se publica un total: total − parte
// despeja lo que se ocultó. Estos tests fijan las tres reglas que lo impiden
// (complemento de un KPI, supresión secundaria en preguntas de opción única y
// ranking de destacados) y el mínimo de respuestas para escribir frases.
import {
  MINIMO_PARA_FRASES,
  MOTIVO_SUPRESION,
} from '../survey/survey.constants';
import {
  completarOcultamiento,
  despejable,
  complementoRevela,
  diaDelFiltro,
  enTandas,
  filaPublicable,
  filtrosActivos,
  MAXIMO_FILTROS,
  publicarEnTandas,
  cruzarRespuestas,
  protegerGrupo,
  serieTemporal,
  evaluarDestacado,
  publicarKpi,
  rankingDestacado,
  validarDefinicionDestacado,
} from './metrics-aggregation';
import type {
  Corte,
  MapasDeNombres,
  OpcionCatalogo,
  RespuestaProyectada,
} from './metrics.types';

const SUP: Corte = { suprimido: true, motivo: MOTIVO_SUPRESION, conteo: null };
const vis = (conteo: number): Corte => ({ suprimido: false, conteo });

describe('complementoRevela', () => {
  it('es true sólo cuando total − parte queda entre 1 y 4', () => {
    expect(complementoRevela(9, 11)).toBe(true);
    expect(complementoRevela(6, 11)).toBe(false);
    expect(complementoRevela(11, 11)).toBe(false);
    expect(complementoRevela(7, 11)).toBe(true);
  });
});

describe('publicarKpi', () => {
  it('oculta el numerador y el valor si el complemento identificaría a alguien', () => {
    const r = publicarKpi(9, 11, 'porcentaje');
    expect(r.numerador).toEqual(SUP);
    expect(r.denominador).toEqual(vis(11));
    expect(r.valor).toBeNull();
  });

  it('publica numerador, denominador y porcentaje cuando ningún lado ni su resta es chico', () => {
    expect(publicarKpi(6, 11, 'porcentaje')).toEqual({
      numerador: vis(6),
      denominador: vis(11),
      valor: 54.5,
    });
  });

  it('todos cumplen la condición: el complemento es cero y se publica', () => {
    expect(publicarKpi(12, 12, 'porcentaje').valor).toBe(100);
  });

  it('en formato conteo el valor es el numerador y respeta la misma regla', () => {
    expect(publicarKpi(8, 10, 'conteo').valor).toBeNull();
    expect(publicarKpi(5, 10, 'conteo').valor).toBe(5);
  });
});

describe('completarOcultamiento (supresión secundaria por masa)', () => {
  it('lo oculto suma de 1 a 4: se oculta además la menor visible distinta de cero', () => {
    // 10 + 8 + 1 + 1 = 20 con los dos 1 ocultos: 20 − 18 = 2 en dos celdas ⇒ 1 y 1.
    expect(
      completarOcultamiento([10, 8, 1, 1], [false, false, true, true], 20),
    ).toEqual([false, true, true, true]);
  });

  it('no oculta de más: si lo oculto ya suma 5 o más, queda igual', () => {
    expect(completarOcultamiento([10, 3, 4], [false, true, true], 17)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it('nada oculto, nada que completar', () => {
    expect(completarOcultamiento([10, 8], [false, false], 18)).toEqual([
      false,
      false,
    ]);
  });

  it('lo oculto suma justo la cantidad de partes ocultas: también se despeja (1 cada una)', () => {
    // 20 + 5 × 1 = 25: 25 − 20 = 5 en 5 celdas ⇒ cada una vale 1.
    expect(
      completarOcultamiento(
        [20, 1, 1, 1, 1, 1],
        [false, true, true, true, true, true],
        25,
      ),
    ).toEqual([true, true, true, true, true, true]);
  });

  it('despejable: de 1 a 4, o tanto como partes ocultas distintas de cero', () => {
    expect(
      despejable(
        [20, 1, 1, 1, 1, 1],
        [false, true, true, true, true, true],
        25,
      ),
    ).toBe(true);
    expect(
      despejable(
        [20, 2, 1, 1, 1, 1],
        [false, true, true, true, true, true],
        26,
      ),
    ).toBe(false);
    expect(despejable([10, 3], [false, true], 13)).toBe(true);
    expect(despejable([10, 7], [false, false], 17)).toBe(false);
    // Todo oculto y cada parte vale 1: aun así se despeja (hay que ocultar el total).
    expect(despejable([1, 1, 1, 1, 1], [true, true, true, true, true], 5)).toBe(
      true,
    );
  });

  it('sigue ocultando hasta cerrar la brecha', () => {
    // Oculto 1; la menor visible es 2 (masa 3), después 3 (masa 6).
    expect(
      completarOcultamiento([20, 3, 2, 1], [false, false, false, true], 26),
    ).toEqual([false, true, true, true]);
  });
});

describe('cruzarRespuestas: total del cruce', () => {
  it('cinco filas de 1 y nada más: el total del cruce tampoco se publica', () => {
    const OPC: OpcionCatalogo[] = [
      { optionId: 'o', valor: 'o', texto: 'O', orden: 0 },
    ];
    const localidades = ['l1', 'l2', 'l3', 'l4', 'l5'];
    const respuestas: RespuestaProyectada[] = localidades.map(
      (localityId, i) => ({
        responseId: `t${i}`,
        etapa: 'ZONAL',
        ventana: 'DURANTE',
        sexo: null,
        disciplineType: 'EQUIPO',
        disciplineId: null,
        categoryId: null,
        localityId,
        enviadaEn: new Date('2026-11-10T12:00:00Z'),
        opciones: new Map([['q', ['o']]]),
      }),
    );
    const mapas: MapasDeNombres = {
      disciplinas: new Map(),
      categorias: new Map(),
      departamentos: new Map(),
      preguntas: new Map(),
      localidades: new Map(
        localidades.map((id) => [
          id,
          {
            nombre: id,
            departmentId: 'd',
            departamento: 'D',
            zona: 'INTERIOR',
          },
        ]),
      ) as MapasDeNombres['localidades'],
    };
    const res = cruzarRespuestas(respuestas, 'q', OPC, 'localidad', mapas, {
      unica: true,
      particion: true,
    });
    expect(res.totalOculto).toBe(true);
  });
});

describe('protegerGrupo', () => {
  it('total 13, Capital 10 e Interior 3: Interior no se despeja restando', () => {
    expect(protegerGrupo([10, 3], 13)).toEqual([SUP, SUP]);
  });

  it('serie por hora: 20 en una hora y 1 en otras cinco no deja despejar las de 1', () => {
    expect(
      protegerGrupo([20, 1, 1, 1, 1, 1], 25).every((c) => c.suprimido),
    ).toBe(true);
  });

  it('dos partes grandes se publican', () => {
    expect(protegerGrupo([10, 7], 17)).toEqual([vis(10), vis(7)]);
  });
});

describe('serieTemporal', () => {
  it('total 13 con 10 un día y 3 otro: el día grande también se oculta', () => {
    const dia = (d: string, k: number) =>
      Array.from({ length: k }, () => new Date(`${d}T12:00:00Z`));
    const puntos = serieTemporal(
      [...dia('2026-01-01', 10), ...dia('2026-01-03', 3)],
      'dia',
    );
    expect(puntos.map((p) => p.conteo)).toEqual([null, null]);
  });
});

describe('cruzarRespuestas: filas chicas y complemento por fila', () => {
  const OPCIONES: OpcionCatalogo[] = [
    { optionId: 'o-no', valor: 'no', texto: 'No', orden: 0 },
    { optionId: 'o-at', valor: 'at', texto: 'Atendido', orden: 1 },
    { optionId: 'o-sin', valor: 'sin', texto: 'Nadie me atendió', orden: 2 },
  ];
  const MAPAS: MapasDeNombres = {
    disciplinas: new Map(),
    categorias: new Map(),
    localidades: new Map(),
    departamentos: new Map(),
    preguntas: new Map(),
  };
  let n = 0;
  const responde = (optionId: string): RespuestaProyectada => ({
    responseId: `r${++n}`,
    etapa: 'ZONAL',
    ventana: 'DURANTE',
    sexo: null,
    disciplineType: 'EQUIPO',
    disciplineId: null,
    categoryId: null,
    localityId: null,
    enviadaEn: new Date('2026-11-10T12:00:00Z'),
    opciones: new Map([['q', [optionId]]]),
  });
  const veces = (k: number, optionId: string) =>
    Array.from({ length: k }, () => responde(optionId));
  const celdas = (respuestas: RespuestaProyectada[]) =>
    cruzarRespuestas(
      respuestas,
      'q',
      OPCIONES,
      'ventana',
      MAPAS,
    ).filas[0]!.celdas.map((c) => (c.suprimido ? null : c.conteo));

  it('una fila con menos de 5 respuestas oculta todas sus celdas, ceros incluidos', () => {
    // Antes: No=0 | Atendido=0 | Nadie=oculto con 3 respuestas ⇒ 3 − 0 − 0 = 3.
    expect(celdas(veces(3, 'o-sin'))).toEqual([null, null, null]);
  });

  it('una celda no se publica si el resto de su fila queda entre 1 y 4', () => {
    // 7 + 2 = 9: el 2 se oculta por chico y el 7 porque 9 − 7 = 2.
    expect(celdas([...veces(7, 'o-no'), ...veces(2, 'o-sin')])).toEqual([
      null,
      0,
      null,
    ]);
  });

  it('con 5 o más respuestas, una opción elegida por todos se publica (el 100 % no deja resto)', () => {
    expect(celdas(veces(7, 'o-sin'))).toEqual([0, 0, 7]);
  });

  it('opción única: dos celdas de 1 no se despejan con el total de la fila', () => {
    const OP4: OpcionCatalogo[] = [
      ...OPCIONES,
      { optionId: 'o-der', valor: 'der', texto: 'Derivado', orden: 3 },
    ];
    const { filas } = cruzarRespuestas(
      [
        ...veces(10, 'o-no'),
        ...veces(8, 'o-at'),
        ...veces(1, 'o-sin'),
        ...veces(1, 'o-der'),
      ],
      'q',
      OP4,
      'ventana',
      MAPAS,
      { unica: true, particion: true },
    );
    expect(filas[0]!.celdas.map((c) => c.conteo)).toEqual([
      10,
      null,
      null,
      null,
    ]);
  });

  it('filas que particionan: total 33 con una fila de 3 oculta la otra también', () => {
    const enEtapa = (
      k: number,
      etapa: 'ZONAL' | 'DEPARTAMENTAL',
      optionId: string,
    ) => veces(k, optionId).map((r) => ({ ...r, etapa }));
    const { filas, totalRespuestas } = cruzarRespuestas(
      [
        ...enEtapa(10, 'ZONAL', 'o-no'),
        ...enEtapa(10, 'ZONAL', 'o-at'),
        ...enEtapa(10, 'ZONAL', 'o-sin'),
        ...enEtapa(3, 'DEPARTAMENTAL', 'o-no'),
      ],
      'q',
      OPCIONES,
      'etapa',
      MAPAS,
      { unica: true, particion: true },
    );
    expect(totalRespuestas).toBe(33);
    for (const fila of filas) {
      expect(fila.totalFila.suprimido).toBe(true);
      expect(fila.celdas.every((c) => c.suprimido)).toBe(true);
    }
  });

  it('una fila grande y repartida se publica entera', () => {
    expect(
      celdas([...veces(10, 'o-no'), ...veces(6, 'o-at'), ...veces(5, 'o-sin')]),
    ).toEqual([10, 6, 5]);
  });
});

describe('evaluarDestacado', () => {
  const r = (opciones: string[]): RespuestaProyectada => ({
    responseId: Math.random().toString(36),
    etapa: 'ZONAL',
    ventana: 'DURANTE',
    sexo: null,
    disciplineType: 'INDIVIDUAL',
    disciplineId: null,
    categoryId: null,
    localityId: null,
    enviadaEn: new Date('2026-11-10T12:00:00Z'),
    opciones: new Map([['q-nec', opciones]]),
  });
  const valorDeOpcion = new Map([
    ['o-tr', 'nec_transporte'],
    ['o-in', 'nec_indumentaria'],
    ['o-al', 'nec_alimentacion'],
  ]);

  it('la base son quienes eligieron alguna opción del destacado; cada opción cuenta una vez por respuesta', () => {
    const { base, conteos } = evaluarDestacado(
      [r(['o-tr', 'o-in']), r(['o-tr']), r([]), r(['o-al'])],
      {
        opciones: ['nec_transporte', 'nec_indumentaria', 'nec_alimentacion'],
        top: 3,
      },
      valorDeOpcion,
    );
    expect(base).toBe(3);
    expect(conteos.get('nec_transporte')).toBe(2);
    expect(conteos.get('nec_indumentaria')).toBe(1);
    expect(conteos.get('nec_alimentacion')).toBe(1);
  });
});

describe('rankingDestacado', () => {
  const opcion = (valor: string, conteo: number) => ({
    valor,
    texto: valor.toUpperCase(),
    conteo,
  });

  it('ordena de mayor a menor, corta en el top y calcula el porcentaje sobre la base', () => {
    const res = rankingDestacado(
      40,
      [opcion('a', 10), opcion('b', 25), opcion('c', 15), opcion('d', 8)],
      { top: 3, unica: false },
    );
    expect(res.base).toEqual(vis(40));
    expect(res.opciones.map((o) => o.valor)).toEqual(['b', 'c', 'a']);
    expect(res.opciones[0]).toMatchObject({ conteo: 25, porcentaje: 62.5 });
    expect(res.ocultas).toBe(0);
    expect(res.puedeAfirmar).toBe(true);
  });

  it('una opción de 1 a 4 no entra al ranking ni se informa su conteo', () => {
    const res = rankingDestacado(40, [opcion('a', 30), opcion('b', 3)], {
      top: 5,
      unica: false,
    });
    expect(res.opciones.map((o) => o.valor)).toEqual(['a']);
    expect(res.ocultas).toBe(1);
    expect(JSON.stringify(res)).not.toMatch(/"conteo":3[,}]/);
  });

  it('una opción que eligieron casi todos no se publica: lo revelaría quienes no la eligieron', () => {
    const res = rankingDestacado(40, [opcion('a', 38), opcion('b', 20)], {
      top: 5,
      unica: false,
    });
    expect(res.opciones.map((o) => o.valor)).toEqual(['b']);
  });

  it('opción única: con una sola oculta, se oculta también la menor visible (no se despeja por resta)', () => {
    // 20 + 9 + 4 = 33: publicar 20 y 9 con base 33 despejaría el 4.
    const res = rankingDestacado(
      33,
      [opcion('a', 20), opcion('b', 9), opcion('c', 4)],
      {
        top: 5,
        unica: true,
      },
    );
    expect(res.opciones.map((o) => o.valor)).toEqual(['a']);
    expect(res.ocultas).toBe(2);
  });

  it('las opciones que nadie eligió no aparecen en el ranking', () => {
    const res = rankingDestacado(10, [opcion('a', 10), opcion('b', 0)], {
      top: 5,
      unica: false,
    });
    expect(res.opciones.map((o) => o.valor)).toEqual(['a']);
  });

  it('una base chica no publica nada, ni cuántas opciones se ocultaron', () => {
    // Antes: base oculta + 4 opciones ocultas en opción única ⇒ base 4, 1 cada una.
    const res = rankingDestacado(
      4,
      [opcion('a', 1), opcion('b', 1), opcion('c', 1), opcion('d', 1)],
      { top: 3, unica: true },
    );
    expect(res.base).toEqual(SUP);
    expect(res.opciones).toEqual([]);
    expect(res.ocultas).toBe(0);
    expect(res.puedeAfirmar).toBe(false);
  });

  it('opción única: base 25 con 20 y cinco de 1: no se publica ninguna', () => {
    const res = rankingDestacado(
      25,
      [
        opcion('a', 20),
        opcion('b', 1),
        opcion('c', 1),
        opcion('d', 1),
        opcion('e', 1),
        opcion('f', 1),
      ],
      { top: 5, unica: true },
    );
    expect(res.opciones).toEqual([]);
  });

  it('opción única: base 5 con cinco opciones de 1: tampoco se publica la base', () => {
    const res = rankingDestacado(
      5,
      [
        opcion('a', 1),
        opcion('b', 1),
        opcion('c', 1),
        opcion('d', 1),
        opcion('e', 1),
      ],
      { top: 5, unica: true },
    );
    expect(res.base).toEqual(SUP);
    expect(res.ocultas).toBe(0);
  });

  it('opción única: base 20 con 10, 8, 1 y 1: se oculta también el 8', () => {
    const res = rankingDestacado(
      20,
      [opcion('a', 10), opcion('b', 8), opcion('c', 1), opcion('d', 1)],
      { top: 5, unica: true },
    );
    expect(res.opciones.map((o) => o.valor)).toEqual(['a']);
    expect(res.ocultas).toBe(3);
  });

  it(`las frases necesitan al menos ${MINIMO_PARA_FRASES} respuestas en la base`, () => {
    const justo = rankingDestacado(MINIMO_PARA_FRASES, [opcion('a', 10)], {
      top: 3,
      unica: false,
    });
    const menos = rankingDestacado(MINIMO_PARA_FRASES - 1, [opcion('a', 10)], {
      top: 3,
      unica: false,
    });
    expect(justo.puedeAfirmar).toBe(true);
    expect(menos.puedeAfirmar).toBe(false);
    expect(menos.opciones).toHaveLength(1);
  });
});

describe('validarDefinicionDestacado', () => {
  it('acepta opciones y top válidos', () => {
    expect(
      validarDefinicionDestacado({ opciones: ['a', 'b'], top: 3 }),
    ).toBeNull();
  });

  it('rechaza definiciones incompletas o fuera de rango', () => {
    expect(validarDefinicionDestacado(null)).not.toBeNull();
    expect(validarDefinicionDestacado({ opciones: [], top: 3 })).not.toBeNull();
    expect(
      validarDefinicionDestacado({ opciones: [''], top: 3 }),
    ).not.toBeNull();
    expect(
      validarDefinicionDestacado({ opciones: ['a'], top: 0 }),
    ).not.toBeNull();
    expect(
      validarDefinicionDestacado({ opciones: ['a'], top: 11 }),
    ).not.toBeNull();
    expect(
      validarDefinicionDestacado({ opciones: ['a'], top: 2.5 }),
    ).not.toBeNull();
  });
});

describe('publicarEnTandas', () => {
  const r = (id: string, hora: string) => ({
    id,
    enviadaEn: new Date(`2026-11-10T${hora}:00Z`),
  });
  const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

  it('publica sólo tandas completas de 5: con 7 salen las 5 más viejas', () => {
    const respuestas = [
      r('g', '10:07'),
      r('a', '10:01'),
      r('f', '10:06'),
      r('b', '10:02'),
      r('e', '10:05'),
      r('c', '10:03'),
      r('d', '10:04'),
    ];
    expect(ids(publicarEnTandas(respuestas, (x) => x.id))).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('con menos de 5 no publica ninguna; con 10 publica las 10', () => {
    const cuatro = ['a', 'b', 'c', 'd'].map((id, i) => r(id, `10:0${i}`));
    expect(publicarEnTandas(cuatro, (x) => x.id)).toEqual([]);
    const diez = Array.from({ length: 10 }, (_, i) =>
      r(`x${i}`, `10:${String(i).padStart(2, '0')}`),
    );
    expect(publicarEnTandas(diez, (x) => x.id)).toHaveLength(10);
  });

  it('a igual hora desempata por id: el resultado no depende del orden de llegada', () => {
    const mismas = ['e', 'b', 'f', 'a', 'd', 'c'].map((id) => r(id, '10:00'));
    expect(ids(publicarEnTandas(mismas, (x) => x.id))).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
  });

  it('entre una lectura y la siguiente cambia por 0 o por 5 respuestas, nunca por 1', () => {
    const todas = Array.from({ length: 23 }, (_, i) =>
      r(`x${String(i).padStart(2, '0')}`, `10:${String(i).padStart(2, '0')}`),
    );
    let anterior = 0;
    for (let n = 1; n <= todas.length; n += 1) {
      const publicadas = publicarEnTandas(todas.slice(0, n), (x) => x.id);
      expect([0, 5]).toContain(publicadas.length - anterior);
      anterior = publicadas.length;
    }
  });
});

describe('enTandas', () => {
  it('redondea un conteo hacia abajo a la tanda de 5', () => {
    expect([0, 4, 5, 9, 10, 23].map(enTandas)).toEqual([0, 0, 5, 5, 10, 20]);
  });
});

describe('diaDelFiltro', () => {
  it('una fecha sola queda igual', () => {
    expect(diaDelFiltro('2026-11-10')).toBe('2026-11-10');
  });

  it('una fecha con hora pierde la hora: el filtro mínimo es el día (UTC)', () => {
    expect(diaDelFiltro('2026-11-10T10:05:00Z')).toBe('2026-11-10');
    expect(diaDelFiltro('2026-11-10T10:05:00.123Z')).toBe('2026-11-10');
    expect(diaDelFiltro('2026-11-10T23:30:00-03:00')).toBe('2026-11-11');
  });
});

describe('filtrosActivos', () => {
  it('cuenta cada filtro una vez y el rango de fechas como uno solo', () => {
    expect(filtrosActivos({})).toEqual([]);
    expect(
      filtrosActivos({
        zona: 'INTERIOR',
        desde: '2026-11-01',
        hasta: '2026-11-10',
      }),
    ).toEqual(['zona', 'fecha']);
    expect(filtrosActivos({ hasta: '2026-11-10' })).toEqual(['fecha']);
    expect(
      filtrosActivos({ departmentId: 'd', localityId: 'l', sexo: 'FEMENINO' }),
    ).toEqual(['localityId', 'departmentId', 'sexo']);
  });

  it('el tope es de 2 filtros a la vez', () => {
    expect(MAXIMO_FILTROS).toBe(2);
  });
});

describe('filaPublicable', () => {
  it('una fila chica no se publica filtrando por ella', () => {
    expect(
      filaPublicable(
        [
          ['CAPITAL', 3],
          ['INTERIOR', 47],
        ],
        50,
        'CAPITAL',
      ),
    ).toBe(false);
  });

  it('tampoco la grande, si al lado hay una chica que se despejaría restando', () => {
    expect(
      filaPublicable(
        [
          ['CAPITAL', 3],
          ['INTERIOR', 47],
        ],
        50,
        'INTERIOR',
      ),
    ).toBe(false);
  });

  it('con todas las filas grandes, cada una se publica', () => {
    expect(
      filaPublicable(
        [
          ['CAPITAL', 12],
          ['INTERIOR', 47],
        ],
        59,
        'INTERIOR',
      ),
    ).toBe(true);
    expect(
      filaPublicable(
        [
          ['CAPITAL', 12],
          ['INTERIOR', 47],
        ],
        59,
        'CAPITAL',
      ),
    ).toBe(true);
  });

  it('con varias filas, se oculta la visible más chica y las demás siguen publicables', () => {
    // 10, 12 y 3 (sin dato): el 3 y el 10 se ocultan; el 12 queda.
    const filas: [string | null, number][] = [
      ['a', 10],
      ['b', 12],
      [null, 3],
    ];
    expect(filaPublicable(filas, 25, 'a')).toBe(false);
    expect(filaPublicable(filas, 25, 'b')).toBe(true);
  });

  it('un valor que no aparece en el corte padre no se publica', () => {
    expect(filaPublicable([['a', 10]], 10, 'z')).toBe(false);
  });
});
