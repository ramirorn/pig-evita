// ===========================================
// Métricas — agregación pura: cruce, umbral, KPIs, serie
// ===========================================
//
// Lo que estos tests fijan es la promesa de anonimato del módulo: ningún
// corte con menos de 5 respuestas sale publicado, y una tabla no permite
// despejar por resta la celda que se ocultó. Lo demás (orden de filas, filas
// "Sin dato", KPIs con `contestaron`) es lo que hace legible el panel.
import { MOTIVO_SUPRESION } from '../survey/survey.constants';
import {
  aplicarUmbral,
  aplicarUmbralCelda,
  aplicarUmbralTabla,
  cruzarRespuestas,
  esDimensionValida,
  evaluarKpi,
  granularidadPara,
  porcentajeKpi,
  preguntaDeDimension,
  serieTemporal,
  validarDefinicionKpi,
} from './metrics-aggregation';
import type {
  MapasDeNombres,
  OpcionCatalogo,
  RespuestaProyectada,
} from './metrics.types';

const Q_LESION = 'q-lesion';
const Q_ESTUDIOS = 'q-estudios';

const OPC_LESION: OpcionCatalogo[] = [
  { optionId: 'o-no', valor: 'no', texto: 'No', orden: 0 },
  {
    optionId: 'o-si-at',
    valor: 'si_atendido',
    texto: 'Sí, atendido',
    orden: 1,
  },
  {
    optionId: 'o-si-no',
    valor: 'si_no_atendido',
    texto: 'Sí, sin atención',
    orden: 2,
  },
];
const OPC_ESTUDIOS: OpcionCatalogo[] = [
  {
    optionId: 'o-seguir',
    valor: 'seguir_estudiando',
    texto: 'Seguir',
    orden: 0,
  },
  {
    optionId: 'o-trabajar',
    valor: 'solo_trabajar',
    texto: 'Trabajar',
    orden: 1,
  },
];

const mapas: MapasDeNombres = {
  disciplinas: new Map([['d-futbol', 'Fútbol']]),
  categorias: new Map(),
  localidades: new Map([
    [
      'l-formosa',
      { nombre: 'Formosa', departmentId: 'dep-formosa', zona: 'CAPITAL' },
    ],
    [
      'l-pirane',
      { nombre: 'Pirané', departmentId: 'dep-pirane', zona: 'INTERIOR' },
    ],
  ]),
  departamentos: new Map([
    ['dep-formosa', 'Formosa'],
    ['dep-pirane', 'Pirané'],
  ]),
  preguntas: new Map([
    [Q_LESION, OPC_LESION],
    [Q_ESTUDIOS, OPC_ESTUDIOS],
  ]),
};

let n = 0;
function respuesta(
  localityId: string | null,
  lesion: string | null,
  estudios: string | null = null,
): RespuestaProyectada {
  n += 1;
  const opciones = new Map<string, string[]>();
  if (lesion) opciones.set(Q_LESION, [lesion]);
  if (estudios) opciones.set(Q_ESTUDIOS, [estudios]);
  return {
    responseId: `r${n}`,
    etapa: 'ZONAL',
    ventana: 'DURANTE',
    sexo: 'MASCULINO',
    disciplineType: 'EQUIPO',
    disciplineId: 'd-futbol',
    categoryId: null,
    localityId,
    enviadaEn: new Date('2026-11-10T10:00:00Z'),
    opciones,
  };
}

const repetir = <T>(veces: number, crear: () => T): T[] =>
  Array.from({ length: veces }, crear);

describe('aplicarUmbral', () => {
  it('suprime por debajo de 5 y publica desde 5', () => {
    expect(aplicarUmbral(4)).toEqual({
      suprimido: true,
      motivo: MOTIVO_SUPRESION,
      conteo: null,
    });
    expect(aplicarUmbral(5)).toEqual({ suprimido: false, conteo: 5 });
  });
});

describe('aplicarUmbralCelda', () => {
  it('publica el cero y suprime de 1 a 4', () => {
    expect(aplicarUmbralCelda(0)).toEqual({ suprimido: false, conteo: 0 });
    expect(aplicarUmbralCelda(1).suprimido).toBe(true);
    expect(aplicarUmbralCelda(4).suprimido).toBe(true);
    expect(aplicarUmbralCelda(5)).toEqual({ suprimido: false, conteo: 5 });
  });
});

describe('dimensiones', () => {
  it('acepta las fijas y pregunta:<id>, rechaza el resto', () => {
    expect(esDimensionValida('zona')).toBe(true);
    expect(esDimensionValida('pregunta:abc')).toBe(true);
    expect(esDimensionValida('edad')).toBe(false);
    expect(preguntaDeDimension('pregunta:abc')).toBe('abc');
    expect(preguntaDeDimension('zona')).toBeNull();
  });
});

describe('cruzarRespuestas', () => {
  it('cruza una pregunta por zona y resuelve departamento desde la localidad', () => {
    const respuestas = [
      ...repetir(6, () => respuesta('l-pirane', 'o-si-no')),
      ...repetir(5, () => respuesta('l-formosa', 'o-no')),
      ...repetir(2, () => respuesta(null, 'o-no')),
    ];

    const { filas, totalRespuestas } = cruzarRespuestas(
      respuestas,
      Q_LESION,
      OPC_LESION,
      'zona',
      mapas,
    );

    expect(totalRespuestas).toBe(13);
    // Sin localidad cuenta como INTERIOR (6 + 2) y CAPITAL son las 5 de Formosa.
    expect(filas.map((f) => [f.etiqueta, f.totalFila.conteo])).toEqual([
      ['INTERIOR', 8],
      ['CAPITAL', 5],
    ]);

    const { filas: porDepto } = cruzarRespuestas(
      respuestas,
      Q_LESION,
      OPC_LESION,
      'departamento',
      mapas,
    );
    expect(porDepto.map((f) => f.etiqueta)).toEqual([
      'Pirané',
      'Formosa',
      'Sin dato',
    ]);
  });

  it('no cuenta las respuestas que no contestaron la pregunta', () => {
    const respuestas = [
      ...repetir(5, () => respuesta('l-pirane', 'o-no')),
      ...repetir(3, () => respuesta('l-pirane', null)),
    ];
    const { totalRespuestas, filas } = cruzarRespuestas(
      respuestas,
      Q_LESION,
      OPC_LESION,
      'localidad',
      mapas,
    );
    expect(totalRespuestas).toBe(5);
    expect(filas[0].totalFila).toEqual({ suprimido: false, conteo: 5 });
  });

  it('pregunta × pregunta: las filas siguen el orden de las opciones y "Sin dato" va al final', () => {
    const respuestas = [
      ...repetir(5, () => respuesta('l-pirane', 'o-si-no', 'o-trabajar')),
      ...repetir(5, () => respuesta('l-pirane', 'o-no', 'o-seguir')),
      ...repetir(5, () => respuesta('l-pirane', 'o-no', null)),
    ];
    const { filas } = cruzarRespuestas(
      respuestas,
      Q_LESION,
      OPC_LESION,
      `pregunta:${Q_ESTUDIOS}`,
      mapas,
    );
    expect(filas.map((f) => f.etiqueta)).toEqual([
      'Seguir',
      'Trabajar',
      'Sin dato',
    ]);
    expect(
      filas[1].celdas.find((c) => c.valor === 'si_no_atendido')?.conteo,
    ).toBe(5);
  });
});

describe('aplicarUmbralTabla', () => {
  it('si una celda está suprimida, el total de la fila también (sin resta posible)', () => {
    const respuestas = [
      ...repetir(7, () => respuesta('l-pirane', 'o-no')),
      ...repetir(2, () => respuesta('l-pirane', 'o-si-no')),
    ];
    const { filas } = cruzarRespuestas(
      respuestas,
      Q_LESION,
      OPC_LESION,
      'localidad',
      mapas,
    );
    // Antes de la segunda pasada la fila publica 9 y ocultaría sólo la celda de 2.
    expect(filas[0].totalFila).toEqual({ suprimido: false, conteo: 9 });

    const protegidas = aplicarUmbralTabla(filas);
    expect(protegidas[0].totalFila.suprimido).toBe(true);
    expect(protegidas[0].celdas.find((c) => c.valor === 'no')).toMatchObject({
      suprimido: false,
      conteo: 7,
    });
  });

  it('deja intacta una fila sin celdas suprimidas', () => {
    const respuestas = [
      ...repetir(5, () => respuesta('l-pirane', 'o-no')),
      ...repetir(5, () => respuesta('l-pirane', 'o-si-at')),
      ...repetir(5, () => respuesta('l-pirane', 'o-si-no')),
    ];
    const { filas } = cruzarRespuestas(
      respuestas,
      Q_LESION,
      OPC_LESION,
      'localidad',
      mapas,
    );
    expect(aplicarUmbralTabla(filas)[0].totalFila).toEqual({
      suprimido: false,
      conteo: 15,
    });
  });
});

describe('evaluarKpi', () => {
  const valorDeOpcion = new Map([
    ...OPC_LESION.map((o) => [o.optionId, o.valor] as const),
    ...OPC_ESTUDIOS.map((o) => [o.optionId, o.valor] as const),
  ]);
  const preguntaDeValor = new Map([
    ...OPC_LESION.map((o) => [o.valor, Q_LESION] as const),
    ...OPC_ESTUDIOS.map((o) => [o.valor, Q_ESTUDIOS] as const),
  ]);

  const respuestas = [
    ...repetir(6, () => respuesta('l-pirane', 'o-si-at', 'o-seguir')),
    ...repetir(4, () => respuesta('l-pirane', 'o-si-no', 'o-trabajar')),
    ...repetir(5, () => respuesta('l-formosa', 'o-no', null)),
  ];

  it('"lesionados atendidos" sobre los lesionados: condición en numerador y denominador', () => {
    const r = evaluarKpi(
      respuestas,
      {
        numerador: [{ valores: ['si_atendido'] }],
        denominador: [{ valores: ['si_atendido', 'si_no_atendido'] }],
        formato: 'porcentaje',
      },
      valorDeOpcion,
      preguntaDeValor,
    );
    expect(r).toEqual({ numerador: 6, denominador: 10 });
    expect(
      porcentajeKpi(aplicarUmbral(r.numerador), aplicarUmbral(r.denominador)),
    ).toBe(60);
  });

  it('"contestaron" toma como base a quienes contestaron la pregunta del numerador', () => {
    const r = evaluarKpi(
      respuestas,
      {
        numerador: [{ valores: ['seguir_estudiando'] }],
        denominador: 'contestaron',
        formato: 'porcentaje',
      },
      valorDeOpcion,
      preguntaDeValor,
    );
    // Las 5 de Formosa no contestaron estudios: quedan fuera de la base.
    expect(r).toEqual({ numerador: 6, denominador: 10 });
  });

  it('"todas" usa el corte completo y el numerador es un AND de condiciones', () => {
    const r = evaluarKpi(
      respuestas,
      {
        numerador: [
          { valores: ['si_no_atendido'] },
          { valores: ['solo_trabajar'] },
        ],
        denominador: 'todas',
        formato: 'conteo',
      },
      valorDeOpcion,
      preguntaDeValor,
    );
    expect(r).toEqual({ numerador: 4, denominador: 15 });
  });

  it('el porcentaje no se publica si algún lado está suprimido', () => {
    expect(porcentajeKpi(aplicarUmbral(4), aplicarUmbral(10))).toBeNull();
    expect(porcentajeKpi(aplicarUmbral(5), aplicarUmbral(0))).toBeNull();
  });
});

describe('validarDefinicionKpi', () => {
  it('acepta una definición completa y rechaza las incompletas', () => {
    expect(
      validarDefinicionKpi({
        numerador: [{ valores: ['a'] }],
        denominador: 'todas',
        formato: 'porcentaje',
      }),
    ).toBeNull();
    expect(validarDefinicionKpi(null)).toMatch(/objeto/);
    expect(
      validarDefinicionKpi({
        numerador: [],
        denominador: 'todas',
        formato: 'conteo',
      }),
    ).toMatch(/numerador/);
    expect(
      validarDefinicionKpi({
        numerador: [{ valores: [''] }],
        denominador: 'todas',
        formato: 'conteo',
      }),
    ).toMatch(/valores/);
    expect(
      validarDefinicionKpi({
        numerador: [{ valores: ['a'] }],
        denominador: [],
        formato: 'conteo',
      }),
    ).toMatch(/denominador/);
    expect(
      validarDefinicionKpi({
        numerador: [{ valores: ['a'] }],
        denominador: 'todas',
        formato: 'x',
      }),
    ).toMatch(/formato/);
  });
});

describe('serieTemporal', () => {
  it('agrupa por día en UTC, ordena y suprime los días con pocas respuestas', () => {
    const fechas = [
      ...repetir(5, () => new Date('2026-11-10T23:30:00Z')),
      ...repetir(2, () => new Date('2026-11-11T01:00:00Z')),
      ...repetir(6, () => new Date('2026-11-09T12:00:00Z')),
    ];
    const serie = serieTemporal(fechas, 'dia');
    expect(serie.map((p) => [p.fecha, p.conteo])).toEqual([
      ['2026-11-09', 6],
      ['2026-11-10', 5],
      ['2026-11-11', null],
    ]);
  });

  it('elige hora si el rango cabe en dos días, día si no', () => {
    expect(
      granularidadPara([
        new Date('2026-11-10T10:00Z'),
        new Date('2026-11-11T09:00Z'),
      ]),
    ).toBe('hora');
    expect(
      granularidadPara([
        new Date('2026-11-01T10:00Z'),
        new Date('2026-11-11T09:00Z'),
      ]),
    ).toBe('dia');
    expect(granularidadPara([])).toBe('dia');
  });
});
