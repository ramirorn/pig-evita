// ===========================================
// Tipos del mapa de Formosa (los consume el módulo generado por geo:build)
// ===========================================

/** Tipo de gobierno local, tal como lo clasifica el IGN. */
export type GeoKind = 'MUNICIPIO' | 'COMISION_FOMENTO' | 'JUNTA_VECINAL';

/** Un gobierno local con polígono propio (ejido). */
export interface GeoArea {
  /** Código INDEC del gobierno local (`in1` del IGN). */
  id: string;
  /** Nombre oficial del IGN, que es contra el que se empareja. */
  name: string;
  kind: GeoKind;
  department: string;
  /** Atributo `d` del `<path>`, ya proyectado al viewBox. */
  d: string;
  /** Ancla para el tooltip: el punto oficial de la localidad. */
  labelX: number;
  labelY: number;
  /** Ejido tan chico que el componente le agrega un marcador para tocarlo. */
  small: boolean;
}

/** Un gobierno local sin polígono: se dibuja como punto. */
export interface GeoPoint {
  id: string;
  name: string;
  kind: GeoKind;
  department: string;
  x: number;
  y: number;
}

/**
 * Rótulo de un departamento, precalculado por `geo:build` para que entre
 * entero dentro del polígono.
 */
export interface GeoDepartmentLabel {
  /** Una o dos líneas, ya en mayúsculas. */
  lines: string[];
  /** Tamaño de letra en unidades del viewBox. */
  size: number;
  /** Caja que ocupa el rótulo (para evitar choques con las burbujas). */
  width: number;
  height: number;
  /**
   * Centros posibles, de más a menos holgados. Todos dejan la caja adentro
   * del departamento; el componente usa el primero que no pise una burbuja.
   */
  anchors: Array<[number, number]>;
}

export interface GeoDepartment {
  name: string;
  label: GeoDepartmentLabel;
  d: string;
}
