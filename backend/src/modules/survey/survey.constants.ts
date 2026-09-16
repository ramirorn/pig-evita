// ===========================================
// Encuesta — constantes del módulo (S20)
// ===========================================

/**
 * Umbral de k-anonimato de los endpoints de métricas.
 *
 * Un corte es cualquier combinación de filtros (etapa + ventana + disciplina +
 * localidad…). Cuando el corte tiene menos de `UMBRAL_K_ANONIMATO` respuestas
 * **no se devuelve el desglose**: se devuelve la marca de supresión.
 *
 * El motivo es concreto, no burocrático. "Handball, Sub-14 Femenino, Laguna
 * Yema, etapa zonal" puede ser un equipo de doce chicas; con tres respuestas y
 * un desglose por opción, cualquiera que estuvo en esa cancha deduce quién
 * contestó qué. Y lo que se contesta es si tiene con quién hablar cuando algo
 * del deporte le preocupa.
 *
 * El número está acá y no escrito a mano en el service para que subirlo sea una
 * decisión de una línea, y para que bajarlo requiera pasar por este comentario.
 * 5 es el piso habitual en estadística oficial para microdatos; si el equipo de
 * la psicóloga pide más resolución, se sube el umbral de la muestra, no se baja
 * el umbral de supresión.
 */
export const UMBRAL_K_ANONIMATO = 5;

/** Motivo único de supresión, para que el frontend no compare strings sueltos. */
export const MOTIVO_SUPRESION = 'MUESTRA_INSUFICIENTE' as const;

/**
 * Cupo del endpoint público de envío de respuestas.
 *
 * Más estricto que `PUBLIC_READ_RATE_LIMIT` (20/min) porque no es una lectura:
 * cada request **escribe una fila que se va a contar**. Sin identidad no hay
 * deduplicación posible (ver el comentario de `SurveyResponse`), así que el
 * rate limit es el único freno que existe contra alguien que infle la muestra
 * desde una pestaña. Una persona real contesta una encuesta por etapa; 3 por
 * minuto deja margen para un reintento por conectividad —que es justamente el
 * problema que tuvo la edición anterior— y corta cualquier script.
 */
export const SURVEY_SUBMIT_RATE_LIMIT = { limit: 3, ttl: 60_000 } as const;
