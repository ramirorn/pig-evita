// ===========================================
// Red del alta de plantel completo
//
// Los tres comportamientos que este chequeo fija son los que, si se rompen, le
// cuestan al encargado media hora de trabajo que no vuelve a hacer:
//
//   1. **El conteo de titulares y suplentes.** El contador de la pantalla y la
//      validación del botón "Agregar" tienen que salir de la misma cuenta. Si
//      divergen, el plantel se completa en pantalla y el envío queda bloqueado
//      sin explicación, o al revés: entra un integrante de más y el backend
//      contesta 400 con los 16 ya cargados.
//   2. **La restauración del borrador.** Es el requisito de producto: cargar un
//      plantel de fútbol 11 son 16 fichas completas. Un F5, un 500 o un clic en
//      el menú lateral no pueden llevárselas. Un `localStorage` que tira en
//      ventana privada tampoco puede voltear el formulario.
//   3. **La disciplina sin plantel configurado.** Hoy `titulares` y
//      `maxSuplentes` son `null` en casi todas las disciplinas. Eso se tiene que
//      detectar en el paso 1, no como un 400 al final.
//
// Se bundlea el **fuente real** con esbuild —igual que `check-nav-roles.mjs`,
// `check-public-cards.mjs` y `check-survey.mjs`—, así que no hay forma de que
// pase en verde con la lógica vieja puesta. El proyecto no tiene runner de
// tests y tiene un presupuesto explícito de cero dependencias nuevas: este es
// el molde que ya usa para lo mismo.
//
// Corre con: npm run check:roster
// ===========================================
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const RAIZ = path.resolve(import.meta.dirname, '..');
const SRC = path.join(RAIZ, 'src');
const SALIDA = path.join(RAIZ, 'node_modules', '.cache', 'check-roster.mjs');

const problemas = [];
const verificaciones = [];

function comprobar(descripcion, condicion, detalle) {
  verificaciones.push(descripcion);
  if (!condicion) problemas.push(`${descripcion}${detalle ? ` — ${detalle}` : ''}`);
}

// -------------------------------------------------
// `localStorage` de mentira, instalado ANTES de importar el bundle
// -------------------------------------------------
function instalarStorage({ rompe = false } = {}) {
  const datos = new Map();
  globalThis.localStorage = {
    getItem(clave) {
      if (rompe) throw new DOMException('acceso denegado');
      return datos.has(clave) ? datos.get(clave) : null;
    },
    setItem(clave, valor) {
      if (rompe) throw new DOMException('cuota excedida');
      datos.set(clave, String(valor));
    },
    removeItem(clave) {
      if (rompe) throw new DOMException('acceso denegado');
      datos.delete(clave);
    },
  };
  return datos;
}

instalarStorage();

execSync(
  [
    'npx esbuild',
    `"${path.join(RAIZ, 'scripts', 'roster.entry.ts')}"`,
    `"--outfile=${SALIDA}"`,
    '--bundle --format=esm --platform=node --log-level=error',
    `"--alias:@=${SRC}"`,
    // `logger.ts` mira `import.meta.env.DEV`, que en Node no existe.
    '"--define:import.meta.env={\\"DEV\\":false}"',
  ].join(' '),
  { cwd: RAIZ, stdio: ['ignore', 'ignore', 'inherit'] },
);

const {
  leerPlantelRequerido,
  plantelSinConfigurar,
  calcularEdad,
  contarPlantel,
  plantelCompleto,
  hayLugar,
  validarIntegrante,
  aplicarIntegrante,
  quitarIntegrante,
  aPayloadPlantel,
  extraerDnisEnConflicto,
  leerBorradorPlantel,
  guardarBorradorPlantel,
  borrarBorradorPlantel,
  disciplineSchema,
  teamInscriptionSchema,
  DisciplineType,
  ResultType,
  Sex,
} = await import(pathToFileURL(SALIDA).href);

// -------------------------------------------------
// Escenario: Fútbol 11 Sub-14 Masculino
// -------------------------------------------------
const UUID = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;

const FUTBOL = {
  type: DisciplineType.EQUIPO,
  titulares: 11,
  maxSuplentes: 5,
};
const FUTBOL_SIN_CONFIGURAR = {
  type: DisciplineType.EQUIPO,
  titulares: null,
  maxSuplentes: null,
};
const AJEDREZ = { type: DisciplineType.INDIVIDUAL, titulares: null, maxSuplentes: null };

const SUB14 = { name: 'Sub-14 Masculino', minAge: 12, maxAge: 14, sex: Sex.MASCULINO };
const SUB14_MIXTO = { name: 'Sub-14 Mixto', minAge: 12, maxAge: 14, sex: Sex.MIXTO };

// Fecha fija: si la edad se calculara contra el reloj real, este chequeo se
// pondría en rojo solo el día que los cumpleaños de mentira quedaran fuera de
// rango, y nadie entendería por qué.
const HOY = new Date('2026-09-15T12:00:00.000Z');

let contadorDni = 40_000_000;
function ficha(extra = {}) {
  contadorDni += 1;
  return {
    dni: String(contadorDni),
    firstName: 'Lucas',
    lastName: `Pérez${contadorDni}`,
    // 13 años al 15/09/2026: dentro de Sub-14.
    birthDate: '2013-03-10',
    sex: Sex.MASCULINO,
    phone: '',
    email: '',
    locality: 'Clorinda',
    department: 'Pilcomayo',
    address: '',
    isSubstitute: false,
    position: '',
    shirtNumber: undefined,
    isCaptain: false,
    ...extra,
  };
}

/** Arma un plantel válido de `cantidad` titulares más `suplentes` suplentes. */
function armarPlantel(cantidad, suplentes = 0) {
  let integrantes = [];
  for (let i = 0; i < cantidad + suplentes; i++) {
    const resultado = validarIntegrante({
      valores: ficha({ isSubstitute: i >= cantidad }),
      integrantes,
      categoria: SUB14,
      requerido: FUTBOL,
      hoy: HOY,
    });
    if (!resultado.ok) throw new Error(`no se pudo armar el plantel: ${resultado.mensaje}`);
    integrantes = aplicarIntegrante(integrantes, resultado.integrante);
  }
  return integrantes;
}

// -------------------------------------------------
// 1. Plantel requerido y disciplina sin configurar
// -------------------------------------------------
{
  comprobar(
    'una disciplina de equipo configurada devuelve su plantel',
    leerPlantelRequerido(FUTBOL)?.titulares === 11 &&
      leerPlantelRequerido(FUTBOL)?.maxSuplentes === 5,
  );
  comprobar(
    'una disciplina de equipo SIN configurar no devuelve plantel',
    leerPlantelRequerido(FUTBOL_SIN_CONFIGURAR) === null,
  );
  comprobar(
    'la disciplina sin configurar se detecta ANTES de cargar a nadie',
    plantelSinConfigurar(FUTBOL_SIN_CONFIGURAR) === true,
  );
  comprobar(
    'una disciplina individual no es "plantel sin configurar"',
    plantelSinConfigurar(AJEDREZ) === false && leerPlantelRequerido(AJEDREZ) === null,
  );
  comprobar(
    'una disciplina configurada no se reporta como sin configurar',
    plantelSinConfigurar(FUTBOL) === false,
  );
  comprobar(
    'maxSuplentes en 0 es una configuración válida, no "sin configurar"',
    leerPlantelRequerido({ ...FUTBOL, maxSuplentes: 0 })?.maxSuplentes === 0,
  );

  // El ABM no puede dejar guardar una disciplina de equipo sin plantel: es lo
  // único que garantiza que la feature se pueda usar con esa disciplina.
  const sinPlantel = disciplineSchema.safeParse({
    name: 'Fútbol 11',
    type: DisciplineType.EQUIPO,
    resultType: ResultType.GOLES,
    minPlayers: 11,
    maxPlayers: 16,
    sortOrder: 0,
    isActive: true,
  });
  comprobar(
    'el ABM rechaza una disciplina de EQUIPO sin titulares ni suplentes',
    sinPlantel.success === false,
  );
  const individualSinPlantel = disciplineSchema.safeParse({
    name: 'Ajedrez',
    type: DisciplineType.INDIVIDUAL,
    resultType: ResultType.PUNTOS,
    minPlayers: 1,
    maxPlayers: 1,
    sortOrder: 0,
    isActive: true,
  });
  comprobar(
    'el ABM NO le exige plantel a una disciplina individual',
    individualSinPlantel.success === true,
  );
  const equipoConPlantel = disciplineSchema.safeParse({
    name: 'Fútbol 11',
    type: DisciplineType.EQUIPO,
    resultType: ResultType.GOLES,
    minPlayers: 11,
    maxPlayers: 16,
    titulares: 11,
    maxSuplentes: 0,
    sortOrder: 0,
    isActive: true,
  });
  comprobar(
    'el ABM acepta una disciplina de equipo con 0 suplentes',
    equipoConPlantel.success === true,
  );
}

// -------------------------------------------------
// 2. El conteo: titulares, suplentes y cuándo está completo
// -------------------------------------------------
{
  const plantel = armarPlantel(7, 2);
  const conteo = contarPlantel(plantel);

  comprobar(
    'el contador separa titulares de suplentes',
    conteo.titulares === 7 && conteo.suplentes === 2,
    `contó ${conteo.titulares}/${conteo.suplentes}`,
  );
  comprobar(
    'con 7 de 11 titulares el plantel NO está completo',
    plantelCompleto(plantel, FUTBOL) === false,
  );
  comprobar(
    'con los 11 titulares el plantel está completo aunque falten suplentes',
    plantelCompleto(armarPlantel(11, 0), FUTBOL) === true,
  );
  comprobar(
    'con 11 titulares y todos los suplentes también está completo',
    plantelCompleto(armarPlantel(11, 5), FUTBOL) === true,
  );

  comprobar('con 7 titulares queda lugar para otro', hayLugar(plantel, FUTBOL, false) === true);

  const completo = armarPlantel(11, 0);
  comprobar(
    'con los 11 titulares ya no queda lugar para otro titular',
    hayLugar(completo, FUTBOL, false) === false,
  );
  comprobar(
    'con los 5 suplentes ya no queda lugar para otro suplente',
    hayLugar(armarPlantel(11, 5), FUTBOL, true) === false,
  );
  comprobar(
    'editar a un titular no le roba su propio lugar',
    hayLugar(completo, FUTBOL, false, completo[3].id) === true,
  );

  // El de más no entra: es el caso que el backend contestaría con un 400 si la
  // pantalla no lo atajara.
  const deMas = validarIntegrante({
    valores: ficha(),
    integrantes: completo,
    categoria: SUB14,
    requerido: FUTBOL,
    hoy: HOY,
  });
  comprobar('el titular número 12 no entra', deMas.ok === false);
  comprobar(
    'el rechazo del titular de más explica qué hacer (marcarlo suplente)',
    deMas.ok === false && /suplente/i.test(deMas.mensaje),
    deMas.ok === false ? deMas.mensaje : '',
  );

  const suplenteDeMas = validarIntegrante({
    valores: ficha({ isSubstitute: true }),
    integrantes: armarPlantel(11, 5),
    categoria: SUB14,
    requerido: FUTBOL,
    hoy: HOY,
  });
  comprobar('el suplente número 6 no entra', suplenteDeMas.ok === false);

  comprobar(
    'quitar a un integrante libera su lugar',
    contarPlantel(quitarIntegrante(completo, completo[0].id)).titulares === 10,
  );
}

// -------------------------------------------------
// 3. Validación de cada ficha ANTES de que entre a la lista
// -------------------------------------------------
{
  const plantel = armarPlantel(3, 0);

  const dniRepetido = validarIntegrante({
    valores: ficha({ dni: plantel[1].dni }),
    integrantes: plantel,
    categoria: SUB14,
    requerido: FUTBOL,
    hoy: HOY,
  });
  comprobar('un DNI repetido dentro del plantel no entra', dniRepetido.ok === false);
  comprobar(
    'el rechazo por DNI repetido dice con quién choca',
    dniRepetido.ok === false && dniRepetido.mensaje.includes(plantel[1].lastName),
    dniRepetido.ok === false ? dniRepetido.mensaje : '',
  );

  // Corregir a alguien sin cambiarle el DNI no puede chocar consigo mismo.
  const seEditaASiMismo = validarIntegrante({
    valores: { ...plantel[1], firstName: 'Lucas Matías' },
    integrantes: plantel,
    categoria: SUB14,
    requerido: FUTBOL,
    editandoId: plantel[1].id,
    hoy: HOY,
  });
  comprobar('corregir a un integrante no choca contra su propio DNI', seEditaASiMismo.ok === true);

  const muyGrande = validarIntegrante({
    // 18 años al 15/09/2026: fuera de Sub-14.
    valores: ficha({ birthDate: '2008-01-05' }),
    integrantes: plantel,
    categoria: SUB14,
    requerido: FUTBOL,
    hoy: HOY,
  });
  comprobar('alguien fuera del rango de edad no entra al plantel', muyGrande.ok === false);
  comprobar(
    'el rechazo por edad dice la edad y el rango de la categoría',
    muyGrande.ok === false && /18/.test(muyGrande.mensaje) && /12/.test(muyGrande.mensaje),
    muyGrande.ok === false ? muyGrande.mensaje : '',
  );

  const otraRama = validarIntegrante({
    valores: ficha({ sex: Sex.FEMENINO }),
    integrantes: plantel,
    categoria: SUB14,
    requerido: FUTBOL,
    hoy: HOY,
  });
  comprobar('el sexo que no corresponde a la categoría no entra', otraRama.ok === false);
  comprobar(
    'una categoría MIXTA acepta las dos ramas',
    validarIntegrante({
      valores: ficha({ sex: Sex.FEMENINO }),
      integrantes: plantel,
      categoria: SUB14_MIXTO,
      requerido: FUTBOL,
      hoy: HOY,
    }).ok === true,
  );

  const dniTrucho = validarIntegrante({
    valores: ficha({ dni: '00000000' }),
    integrantes: plantel,
    categoria: SUB14,
    requerido: FUTBOL,
    hoy: HOY,
  });
  comprobar(
    'las reglas duras del participante (DNI de dígitos repetidos) valen igual acá',
    dniTrucho.ok === false,
  );
}

// -------------------------------------------------
// 4. Capitán: como mucho uno
// -------------------------------------------------
{
  let plantel = armarPlantel(3, 0);

  const primero = validarIntegrante({
    valores: ficha({ isCaptain: true }),
    integrantes: plantel,
    categoria: SUB14,
    requerido: FUTBOL,
    hoy: HOY,
  });
  plantel = aplicarIntegrante(plantel, primero.integrante);
  comprobar(
    'se puede marcar un capitán',
    plantel.filter((i) => i.isCaptain).length === 1,
  );

  const segundo = validarIntegrante({
    valores: ficha({ isCaptain: true }),
    integrantes: plantel,
    categoria: SUB14,
    requerido: FUTBOL,
    hoy: HOY,
  });
  plantel = aplicarIntegrante(plantel, segundo.integrante);
  comprobar(
    'marcar un segundo capitán desmarca al anterior, no rechaza el alta',
    plantel.filter((i) => i.isCaptain).length === 1,
    `quedaron ${plantel.filter((i) => i.isCaptain).length}`,
  );
  comprobar(
    'el capitán que queda es el último marcado',
    plantel.find((i) => i.isCaptain)?.dni === segundo.integrante.dni,
  );
}

// -------------------------------------------------
// 5. El payload que viaja
// -------------------------------------------------
{
  const plantel = armarPlantel(11, 2);
  const equipo = {
    disciplineId: UUID(1),
    categoryId: UUID(2),
    teamName: '  Escuela N° 12 Clorinda  ',
    locality: 'Clorinda',
    department: 'Pilcomayo',
  };
  const payload = aPayloadPlantel(equipo, plantel);

  // Los nombres de campo son el contrato con `CreateTeamInscriptionDto`. Se
  // fijan acá porque ya se rompieron una vez: el cliente arrancó con
  // `nombreEquipo` / `integrantes` / `esSuplente` y el DTO usa
  // `teamName` / `members` / `isSubstitute`. Un `class-validator` que no
  // encuentra el campo contesta 400 con los 16 chicos ya cargados.
  comprobar(
    'el payload usa los nombres de campo del DTO del backend',
    Object.keys(payload).sort().join() ===
      ['categoryId', 'department', 'disciplineId', 'locality', 'members', 'teamName'].join(),
    Object.keys(payload).sort().join(),
  );
  comprobar(
    'cada integrante del payload usa isSubstitute, no esSuplente',
    payload.members.every(
      (i) => typeof i.isSubstitute === 'boolean' && i.esSuplente === undefined,
    ),
  );

  comprobar('el payload lleva a todo el plantel', payload.members.length === 13);
  comprobar('el nombre del equipo viaja recortado', payload.teamName === 'Escuela N° 12 Clorinda');
  comprobar(
    'los opcionales vacíos se omiten en vez de viajar como cadena vacía',
    payload.members.every(
      (i) => i.phone === undefined && i.email === undefined && i.address === undefined,
    ),
  );
  comprobar(
    'el payload conserva quién es titular y quién suplente',
    payload.members.filter((i) => i.isSubstitute).length === 2,
  );
  comprobar(
    'el payload completo valida contra el schema del envío',
    teamInscriptionSchema.safeParse({ ...equipo, members: plantel }).success === true,
  );

  // La revalidación previa al envío es la que atrapa una ficha rota que volvió
  // de un borrador viejo: el borrador se guarda con forma laxa a propósito.
  const conFichaRota = teamInscriptionSchema.safeParse({
    ...equipo,
    members: [...plantel.slice(1), { ...plantel[0], dni: '123' }],
  });
  comprobar(
    'una ficha inválida restaurada de un borrador no llega al backend',
    conFichaRota.success === false,
  );
  comprobar(
    'el error de la ficha rota apunta a su posición en el plantel',
    conFichaRota.success === false &&
      conFichaRota.error.issues[0].path[0] === 'members' &&
      typeof conFichaRota.error.issues[0].path[1] === 'number',
  );
}

// -------------------------------------------------
// 6. Quién rechazó el backend: se señala a esa persona, no un toast genérico
// -------------------------------------------------
{
  const plantel = armarPlantel(11, 0);
  const elQueChoca = plantel[4];

  const errorConTexto = {
    response: {
      status: 409,
      data: {
        message: `El participante ${elQueChoca.firstName} ${elQueChoca.lastName} (DNI ${elQueChoca.dni}) ya está inscripto en esta categoría`,
      },
    },
  };
  comprobar(
    'del mensaje del backend se saca el DNI del que ya estaba inscripto',
    extraerDnisEnConflicto(errorConTexto, plantel).join() === elQueChoca.dni,
    extraerDnisEnConflicto(errorConTexto, plantel).join(),
  );

  const errorEstructurado = {
    response: {
      status: 409,
      data: { message: 'Hay integrantes ya inscriptos', dnis: [elQueChoca.dni, plantel[7].dni] },
    },
  };
  comprobar(
    'si el backend manda los DNIs estructurados, también se leen',
    extraerDnisEnConflicto(errorEstructurado, plantel).length === 2,
  );

  const errorConNumeroAjeno = {
    response: { status: 400, data: { message: 'Error interno 12345678 no relacionado' } },
  };
  comprobar(
    'un número que no es de nadie del plantel no marca a nadie',
    extraerDnisEnConflicto(errorConNumeroAjeno, plantel).length === 0,
  );
  comprobar(
    'un error de red (sin respuesta) no marca a nadie',
    extraerDnisEnConflicto(new Error('Network Error'), plantel).length === 0,
  );
}

// -------------------------------------------------
// 7. El borrador: se guarda, vuelve entero, y se borra recién al confirmar
// -------------------------------------------------
{
  instalarStorage();

  const datosEquipo = {
    disciplineId: UUID(1),
    categoryId: UUID(2),
    teamName: 'Escuela N° 12',
    locality: 'Clorinda',
    department: 'Pilcomayo',
  };
  const plantel = armarPlantel(7, 2);

  comprobar('sin nada guardado, no hay borrador', leerBorradorPlantel() === null);

  guardarBorradorPlantel(datosEquipo, plantel);
  const recuperado = leerBorradorPlantel();

  comprobar('el plantel a medio cargar vuelve después de un F5', recuperado !== null);
  comprobar(
    'vuelven TODOS los integrantes, no un subconjunto',
    recuperado?.members?.length === 9,
    `volvieron ${recuperado?.members?.length}`,
  );
  comprobar(
    'el borrador conserva la disciplina y la categoría elegidas',
    recuperado?.disciplineId === datosEquipo.disciplineId &&
      recuperado?.categoryId === datosEquipo.categoryId,
  );
  comprobar(
    'el borrador conserva los datos del equipo',
    recuperado?.teamName === 'Escuela N° 12' && recuperado?.locality === 'Clorinda',
  );
  comprobar(
    'el borrador conserva quién es titular y quién suplente',
    contarPlantel(recuperado?.members ?? []).suplentes === 2,
  );
  comprobar(
    'el borrador conserva los datos personales de cada ficha',
    recuperado?.members?.[0]?.dni === plantel[0].dni &&
      recuperado?.members?.[0]?.birthDate === plantel[0].birthDate,
  );

  borrarBorradorPlantel();
  comprobar(
    'al confirmarse el alta el borrador se borra',
    leerBorradorPlantel() === null,
  );

  // Un plantel que quedó vacío no deja un borrador fantasma dando vueltas.
  instalarStorage();
  guardarBorradorPlantel(datosEquipo, plantel);
  guardarBorradorPlantel(datosEquipo, []);
  comprobar('un plantel sin integrantes no deja borrador', leerBorradorPlantel() === null);

  // Un borrador viejo no reaparece meses después pisando el trabajo de hoy.
  instalarStorage();
  guardarBorradorPlantel(datosEquipo, plantel, new Date('2026-01-01T00:00:00.000Z'));
  comprobar(
    'un borrador de hace meses no se restaura',
    leerBorradorPlantel(new Date('2026-09-15T00:00:00.000Z')) === null,
  );
  comprobar(
    'un borrador de ayer sí se restaura',
    (() => {
      instalarStorage();
      guardarBorradorPlantel(datosEquipo, plantel, new Date('2026-09-14T00:00:00.000Z'));
      return leerBorradorPlantel(new Date('2026-09-15T00:00:00.000Z')) !== null;
    })(),
  );

  // Texto corrupto o de otra versión del formulario: se descarta, no rompe.
  const datos = instalarStorage();
  datos.set('evita_plantel_borrador_v1', '{ esto no es JSON');
  comprobar('un borrador corrupto no rompe la lectura', leerBorradorPlantel() === null);

  datos.set(
    'evita_plantel_borrador_v1',
    JSON.stringify({ disciplineId: UUID(1), members: 'ayer' }),
  );
  comprobar(
    'un borrador con otra forma se descarta en vez de restaurarse a medias',
    leerBorradorPlantel() === null,
  );
}

// -------------------------------------------------
// 8. Modo privado: `localStorage` que tira no puede voltear el formulario
// -------------------------------------------------
{
  instalarStorage({ rompe: true });

  let exploto = false;
  let avisoDeQueNoGuarda = true;
  try {
    avisoDeQueNoGuarda =
      guardarBorradorPlantel(
        {
          disciplineId: UUID(1),
          categoryId: UUID(2),
          teamName: 'X',
          locality: 'Clorinda',
          department: 'Pilcomayo',
        },
        armarPlantel(2, 0),
      ) === false;
    comprobar('leer con localStorage roto devuelve null', leerBorradorPlantel() === null);
    borrarBorradorPlantel();
  } catch {
    exploto = true;
  }

  comprobar(
    'con localStorage inaccesible (ventana privada) nada tira una excepción',
    !exploto,
  );
  comprobar(
    'cuando no se puede guardar, se avisa en vez de mentir que se guardó',
    avisoDeQueNoGuarda,
  );
}

// -------------------------------------------------
// 9. Cálculo de edad
// -------------------------------------------------
{
  comprobar(
    'el cumpleaños todavía no cumplido resta un año',
    calcularEdad('2013-12-25', HOY) === 12,
    String(calcularEdad('2013-12-25', HOY)),
  );
  comprobar(
    'el cumpleaños del día ya cuenta',
    calcularEdad('2013-09-15', HOY) === 13,
    String(calcularEdad('2013-09-15', HOY)),
  );
  comprobar('una fecha vacía no rompe el cálculo', calcularEdad('', HOY) === null);
  comprobar('una fecha inventada no rompe el cálculo', calcularEdad('no-es-fecha', HOY) === null);
}

// -------------------------------------------------
// Resultado
// -------------------------------------------------
if (problemas.length > 0) {
  console.error(`\n❌ ${problemas.length} problema(s) en el alta de plantel:\n`);
  for (const problema of problemas) console.error(`  · ${problema}`);
  console.error('');
  process.exit(1);
}

console.log(`Chequeos ejecutados: ${verificaciones.length}`);
console.log(
  '✅ El conteo del plantel, la recuperación del borrador y el corte por disciplina sin configurar funcionan.',
);
