// ===========================================
// Enums del dominio
// ===========================================
// ============ ENUMS ============

export enum UserRole {
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN_PROVINCIAL = 'ADMIN_PROVINCIAL',
  ADMIN_DEPARTAMENTAL = 'ADMIN_DEPARTAMENTAL',
  ADMIN_ZONAL = 'ADMIN_ZONAL',
  COORDINADOR = 'COORDINADOR',
  DELEGADO = 'DELEGADO',
  ENTRENADOR = 'ENTRENADOR',
  ARBITRO = 'ARBITRO',
  OPERADOR_MESA = 'OPERADOR_MESA',
}

export enum Sex {
  MASCULINO = 'MASCULINO',
  FEMENINO = 'FEMENINO',
  MIXTO = 'MIXTO',
}

/** Cómo define una categoría su rango: edad cumplida o año de nacimiento. */
export enum AgeCriterion {
  AGE = 'AGE',
  BIRTH_YEAR = 'BIRTH_YEAR',
}

export enum DisciplineType {
  INDIVIDUAL = 'INDIVIDUAL',
  EQUIPO = 'EQUIPO',
}

export enum ResultType {
  TIEMPO = 'TIEMPO',
  GOLES = 'GOLES',
  SETS = 'SETS',
  PUNTOS = 'PUNTOS',
  POSICIONES = 'POSICIONES',
}

export enum InscriptionStatus {
  PENDIENTE = 'PENDIENTE',
  REVISADA = 'REVISADA',
  APROBADA = 'APROBADA',
  RECHAZADA = 'RECHAZADA',
}

export enum DocumentType {
  DNI_FRENTE = 'DNI_FRENTE',
  DNI_DORSO = 'DNI_DORSO',
  CERTIFICADO_MEDICO = 'CERTIFICADO_MEDICO',
  AUTORIZACION_PARENTAL = 'AUTORIZACION_PARENTAL',
  FOTO = 'FOTO',
  OTRO = 'OTRO',
}

export enum DocumentStatus {
  PENDIENTE = 'PENDIENTE',
  APROBADO = 'APROBADO',
  RECHAZADO = 'RECHAZADO',
}

export enum CompetitionStage {
  ZONAL = 'ZONAL',
  DEPARTAMENTAL = 'DEPARTAMENTAL',
  PROVINCIAL = 'PROVINCIAL',
}

export enum CompetitionFormat {
  ROUND_ROBIN = 'ROUND_ROBIN',
  ELIMINACION_DIRECTA = 'ELIMINACION_DIRECTA',
  FASE_GRUPOS = 'FASE_GRUPOS',
}

export enum CompetitionStatus {
  BORRADOR = 'BORRADOR',
  ACTIVA = 'ACTIVA',
  FINALIZADA = 'FINALIZADA',
}

export enum MatchStatus {
  PROGRAMADO = 'PROGRAMADO',
  EN_CURSO = 'EN_CURSO',
  FINALIZADO = 'FINALIZADO',
  SUSPENDIDO = 'SUSPENDIDO',
}
