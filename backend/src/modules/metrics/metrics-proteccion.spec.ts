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
  aplicarSupresionComplementaria,
  complementoRevela,
  evaluarDestacado,
  publicarKpi,
  rankingDestacado,
  suprimirComplementaria,
  validarDefinicionDestacado,
} from './metrics-aggregation';
import type { Corte, FilaCruce, RespuestaProyectada } from './metrics.types';

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

describe('suprimirComplementaria', () => {
  it('con una sola celda oculta, oculta también la menor visible distinta de cero', () => {
    expect(suprimirComplementaria([vis(20), SUP, vis(7), vis(0)])).toEqual([
      vis(20),
      SUP,
      SUP,
      vis(0),
    ]);
  });

  it('con dos o más celdas ocultas no toca nada', () => {
    const celdas = [vis(20), SUP, SUP, vis(7)];
    expect(suprimirComplementaria(celdas)).toEqual(celdas);
  });

  it('sin celdas ocultas no toca nada', () => {
    const celdas = [vis(20), vis(7)];
    expect(suprimirComplementaria(celdas)).toEqual(celdas);
  });
});

describe('aplicarSupresionComplementaria', () => {
  const fila = (conteos: (number | null)[]): FilaCruce => ({
    clave: 'INTERIOR',
    etiqueta: 'Interior',
    celdas: conteos.map((c, i) => ({
      optionId: `o${i}`,
      valor: `v${i}`,
      texto: `Opción ${i}`,
      ...(c === null ? SUP : vis(c)),
    })),
    totalFila: SUP,
  });

  it('aplica la regla fila por fila', () => {
    const [a, b] = aplicarSupresionComplementaria([
      fila([20, null, 7]),
      fila([20, 9, 7]),
    ]);
    expect(a!.celdas.map((c) => c.conteo)).toEqual([20, null, null]);
    expect(b!.celdas.map((c) => c.conteo)).toEqual([20, 9, 7]);
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

  it('una base chica no publica nada', () => {
    const res = rankingDestacado(4, [opcion('a', 4)], { top: 3, unica: false });
    expect(res.base).toEqual(SUP);
    expect(res.opciones).toEqual([]);
    expect(res.puedeAfirmar).toBe(false);
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
