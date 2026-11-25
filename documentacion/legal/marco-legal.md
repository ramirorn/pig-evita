# Marco legal aplicable — Plataforma Integral de Gestión de los Juegos Evita (Formosa)

| | |
|---|---|
| **Proyecto** | Sistema Integral Juegos Evita Formoseños |
| **Cliente / responsable del tratamiento** | Secretaría de Deportes y Recreación Comunitaria de la Provincia de Formosa |
| **Jurisdicción** | República Argentina — Provincia de Formosa — Ciudad de Formosa (capital) |
| **Fecha** | 25/11/2026 |
| **Versión del sistema analizada** | rama `dev-lucas`, commit `58a8e9c` |
| **Elaborado por** | Equipo de desarrollo (borrador técnico para revisión del área legal) |
| **Estado** | Borrador. **No es asesoramiento jurídico**: debe validarlo la Dirección de Asuntos Jurídicos de la Secretaría o la Fiscalía de Estado de la provincia. |

Este documento reúne las normas que alcanzan al sistema, explica **qué exige cada una en concreto para este proyecto**, compara esas exigencias con el estado actual del código y lista lo que falta hacer y quién debe hacerlo. Las normas se verificaron en fuentes oficiales (argentina.gob.ar, Boletín Oficial) cuando fue posible; las que no se pudieron confirmar están marcadas con ⚠️ y se listan en la sección 8.

## Contenido

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Qué datos trata el sistema](#2-qué-datos-trata-el-sistema)
3. [Jerarquía de normas y competencia nacional / provincial](#3-jerarquía-de-normas-y-competencia-nacional--provincial)
4. [Detalle de cada norma y cómo afecta al proyecto](#4-detalle-de-cada-norma-y-cómo-afecta-al-proyecto)
5. [Matriz de cumplimiento](#5-matriz-de-cumplimiento)
6. [Decisiones y trámites que corresponden a la Secretaría](#6-decisiones-y-trámites-que-corresponden-a-la-secretaría)
7. [Tareas técnicas para el equipo](#7-tareas-técnicas-para-el-equipo)
8. [Puntos no verificados](#8-puntos-no-verificados)
9. [Índice de normas](#9-índice-de-normas)
10. [Fuentes](#10-fuentes)

---

## 1. Resumen ejecutivo

**Por qué este sistema tiene una carga legal alta.** No es un sitio informativo: es una **base de datos pública** (la lleva un organismo del Estado provincial) con **datos personales de menores de edad**, incluidos **datos de salud** (certificados médicos), **imágenes del DNI**, **fotos** y **domicilios**. Además publica fixtures, resultados y noticias, y tiene una encuesta de bienestar que contestan menores. Cada uno de esos rasgos activa una norma distinta.

**Normas con impacto directo (las que hay que cumplir sí o sí):**

| Norma | Por qué aplica | Impacto |
|---|---|---|
| **Constitución Nacional, art. 43** y **Convención sobre los Derechos del Niño** (Ley 23.849, jerarquía constitucional por el art. 75 inc. 22) | Hábeas data e intimidad del niño | Alto |
| **Ley 25.326** de Protección de los Datos Personales y **Decreto 1558/2001** | Toda la base de participantes, documentos, usuarios y auditoría | **Muy alto** |
| **Ley 26.061** de Protección Integral de Niñas, Niños y Adolescentes | Publicación de datos e imágenes de menores; derecho al deporte | **Muy alto** |
| **Código Civil y Comercial** (Ley 26.994): arts. 25, 26, 51–53 y 1770 | Imagen, intimidad, capacidad progresiva de los adolescentes | Alto |
| **Constitución de la Provincia de Formosa**: arts. 10, 12, 14, 69, 70 y 72 | Protección de datos de los habitantes, acceso a la información, niñez, juventud y discapacidad | Alto |
| **Ley 27.483** (Convenio 108) y **Ley 27.699** (Convenio 108+) | Estándar internacional de protección de datos que Argentina ratificó | Medio |
| **Resolución AAIP 47/2018** | Medidas de seguridad recomendadas | Medio (referencia técnica) |

**Normas con impacto según cómo se use o despliegue el sistema:** Ley 26.653 de accesibilidad web (Decreto 656/2019), Ley 27.275 de acceso a la información pública, Ley 26.388 de delitos informáticos, Ley 11.723 de propiedad intelectual (con la Ley 25.036 sobre software), Ley 25.506 de firma digital, Ley 26.462 de los Juegos Nacionales Evita y Ley 20.655 del deporte.

**Las cinco brechas más importantes hoy:**

1. **No hay política de privacidad ni aviso informativo** en el sistema. El propio código lo reconoce (`frontend/src/components/layout/Footer.tsx`, enlaces legales vacíos a propósito). Incumple el deber de información del art. 6 de la Ley 25.326.
2. **Se guardan certificados médicos** (`DocumentType.CERTIFICADO_MEDICO`), que son **datos sensibles** (art. 2 y 7 de la Ley 25.326), sin una base legal ni un plazo de conservación definidos por escrito.
3. **No está definido qué se publica de los menores** en fixtures, rankings y noticias (VULN-28 del relevamiento OWASP). Es la decisión que exige el art. 22 de la Ley 26.061.
4. **No hay plazo de conservación ni procedimiento de borrado** de participantes, documentos y registros de auditoría (VULN-27). Incumple el principio de calidad del art. 4 inc. 7 de la Ley 25.326.
5. **No hay procedimiento para que una persona ejerza sus derechos** de acceso, rectificación y supresión (arts. 14 a 16 de la Ley 25.326), que tienen plazos cortos: 10 días corridos y 5 días hábiles.

Las brechas 1, 3 y 4 dependen sobre todo de **decisiones de la Secretaría**; el equipo puede implementarlas en pocos días una vez decididas (sección 7).

---

## 2. Qué datos trata el sistema

Relevado del esquema de base de datos (`backend/prisma/schema.prisma`) y del almacenamiento de archivos (MinIO).

| Dato | Dónde se guarda | De quién | Clasificación según la Ley 25.326 |
|---|---|---|---|
| DNI, nombre, apellido, fecha de nacimiento, sexo | `Participant` | Participantes, en su mayoría **menores** | Dato personal |
| Teléfono, email, domicilio, localidad, departamento | `Participant` | Participantes | Dato personal |
| Imagen del DNI (frente y dorso) | `Document` + MinIO (`DNI_FRENTE`, `DNI_DORSO`) | Participantes | Dato personal; documento de identidad (alto riesgo de suplantación) |
| **Certificado médico** | `Document` + MinIO (`CERTIFICADO_MEDICO`) | Participantes | **Dato sensible** (salud), art. 2 y art. 7 |
| Autorización parental | `Document` + MinIO (`AUTORIZACION_PARENTAL`) | Padres o tutores | Dato personal (incluye datos del adulto firmante) |
| Foto | `Document` + MinIO (`FOTO`) | Participantes | Dato personal; **imagen** (art. 53 del CCyC) |
| Inscripción, equipo, categoría, código QR | `Inscription`, `Team`, `TeamMember` | Participantes | Dato personal |
| Resultados y posiciones | `Result`, `Match` | Participantes | Dato personal cuando identifica a la persona; se **publica** |
| Respuestas de la encuesta de bienestar | `SurveyResponse`, `SurveyAnswer` | Menores, de forma anónima | Pensadas como anónimas; pueden volverse **dato sensible** si se reidentifican (VULN-35) |
| Email, nombre, rol, territorio asignado, hash de contraseña | `User` | Personal de la Secretaría, delegados, árbitros | Dato personal |
| IP, user agent, acción y cambios | `AuditLog` | Usuarios del sistema | Dato personal |

**Conclusiones para el análisis legal:**
- La base es de **titularidad pública** (la lleva un organismo provincial), lo que cambia algunas reglas, por ejemplo el consentimiento (ver 4.2).
- Hay **datos sensibles** (salud), lo que exige un nivel de protección reforzado.
- La mayoría de los titulares son **menores**: las decisiones las toman sus padres o tutores, pero los adolescentes también tienen derecho a ser oídos (art. 26 del CCyC y art. 24 de la Ley 26.061).
- El sistema **publica** parte de estos datos (resultados, fixtures, noticias con fotos).

---

## 3. Jerarquía de normas y competencia nacional / provincial

```
Constitución Nacional (art. 43 hábeas data; art. 75 inc. 22: tratados con jerarquía constitucional,
                       entre ellos la Convención sobre los Derechos del Niño y la de Personas con Discapacidad)
        │
        ├── Tratados con jerarquía superior a las leyes: Convenio 108 (Ley 27.483) y 108+ (Ley 27.699)
        │
        ├── Leyes nacionales de orden público, aplicables en todo el país:
        │     Ley 25.326 (caps. I a IV y art. 32, según su art. 44) · Ley 26.061 (art. 2) ·
        │     Código Civil y Comercial · Código Penal (Ley 26.388)
        │
        ├── Leyes nacionales que rigen para el Estado nacional y a las que las provincias pueden adherir:
        │     Ley 27.275 (acceso a la información) · Ley 26.653 (accesibilidad web) · Ley 26.462 (Juegos Evita)
        │
        └── Provincia de Formosa:
              Constitución provincial (texto de 2003, reformada en 2025) · leyes provinciales ·
              decretos y resoluciones de la Secretaría
                    │
                    └── Municipalidad de la Ciudad de Formosa (no interviene salvo convenio)
```

**Qué significa en la práctica:**

- **La Ley 25.326 rige en Formosa aunque la provincia no haya adherido.** Su art. 44 declara de orden público y aplicables en todo el territorio los capítulos de principios, derechos de los titulares y obligaciones de los responsables. Lo que se invita a adherir es la parte procesal y de control. No se encontró una ley de adhesión de Formosa (⚠️, sección 8).
- **La Ley 26.061 también rige directamente**: su art. 2 la declara de aplicación obligatoria en toda medida administrativa que se adopte respecto de personas menores de 18 años. Las fuentes consultadas indican que Formosa no adecuó del todo su legislación provincial de minoridad (Ley 1089/1981), pero eso no la exime de la ley nacional.
- **Las leyes 27.275 y 26.653 obligan al Estado nacional.** Para un organismo provincial dependen de la adhesión de Formosa, que no se encontró. Aun así, la Constitución provincial garantiza el libre acceso a las fuentes de información (art. 10) y protege a las personas con discapacidad (art. 72), y la Convención sobre los Derechos de las Personas con Discapacidad tiene jerarquía constitucional.
- **La Municipalidad de la Ciudad de Formosa no tiene un rol** en este sistema salvo que se firme un convenio (por ejemplo, para la etapa local de los Juegos). En ese caso habría una **cesión de datos** entre organismos (ver 4.2, art. 11).

---

## 4. Detalle de cada norma y cómo afecta al proyecto

### 4.1 Constitución Nacional y tratados

**Constitución Nacional, art. 43, tercer párrafo (hábeas data).** Toda persona puede interponer una acción para conocer los datos que constan sobre ella en registros públicos o privados destinados a dar informes, y exigir su supresión, rectificación, confidencialidad o actualización si son falsos o discriminatorios.
- **Para el proyecto:** cualquier participante (o sus padres) puede reclamar judicialmente si el sistema no le permite ver o corregir sus datos. Es la garantía detrás de los arts. 14 a 16 de la Ley 25.326.

**Convención sobre los Derechos del Niño (Ley 23.849; jerarquía constitucional, art. 75 inc. 22).**
- Art. 3: el **interés superior del niño** es una consideración primordial en toda medida de las autoridades administrativas.
- Art. 16: ningún niño será objeto de injerencias arbitrarias en su vida privada.
- Art. 31: derecho al juego y a las actividades recreativas.
- **Para el proyecto:** ante la duda sobre publicar un dato de un menor, debe primar su protección. Es el criterio para decidir VULN-28.

**Convención sobre los Derechos de las Personas con Discapacidad (Ley 26.378; jerarquía constitucional por Ley 27.044).** El art. 9 obliga a asegurar la accesibilidad a la información y a las tecnologías. Refuerza lo que pide la Ley 26.653 (ver 4.7) aunque la provincia no haya adherido a ella.

**Convenio 108 del Consejo de Europa (aprobado por Ley 27.483) y su Protocolo modificatorio, Convenio 108+ (aprobado por Ley 27.699, publicada el 30/11/2022; ratificación depositada el 17/04/2023).** Son tratados internacionales de protección de datos y, como tales, están por encima de las leyes.
- **Para el proyecto:** el 108+ eleva el estándar respecto de la Ley 25.326 en puntos como la **notificación de incidentes de seguridad** a la autoridad de control, la **minimización** y la **protección reforzada de datos sensibles** y de menores. Conviene usarlo como piso al diseñar el plan de respuesta a incidentes.

### 4.2 Ley 25.326 de Protección de los Datos Personales y Decreto 1558/2001

Es la norma central del proyecto. Autoridad de control: la **Agencia de Acceso a la Información Pública (AAIP)**, designada por el Decreto 746/2017.

| Artículo | Qué exige | Cómo aplica a este sistema | Estado actual |
|---|---|---|---|
| **Art. 2** — Definiciones | Define datos personales y **datos sensibles** (entre ellos, la información sobre la salud). | Los certificados médicos son datos sensibles. | No hay tratamiento diferenciado por escrito. |
| **Art. 3** — Licitud | La base debe estar debidamente inscripta y tener una finalidad lícita. | La base debe registrarse y su finalidad debe estar definida (gestión de los Juegos). | ⚠️ No consta inscripción (trámite de la Secretaría). |
| **Art. 4** — Calidad | Datos **ciertos, adecuados, pertinentes y no excesivos** para la finalidad; no usarlos para fines distintos; **destruirlos cuando dejen de ser necesarios**. | Pedir solo lo necesario; no reutilizar los datos fuera de los Juegos; borrar al terminar el plazo. | 🟡 La minimización avanza en el refactor (proyecciones `select`, sacar el domicilio de reportes y respuestas). ❌ No hay plazo ni purga. |
| **Art. 5** — Consentimiento | El tratamiento requiere consentimiento libre, expreso e informado, **salvo** (inc. 2.b) cuando los datos se recaban para el ejercicio de funciones propias de los poderes del Estado. | Como lo trata un organismo público para organizar un programa oficial, la base legal puede ser la **función pública**, no el consentimiento. Pero eso no cubre **publicar** datos de menores ni los datos sensibles, donde conviene contar con la **autorización parental** expresa. | 🟡 Existe el tipo de documento `AUTORIZACION_PARENTAL`; falta definir su texto y qué cubre. |
| **Art. 6** — Información | Al recabar datos hay que informar, en forma expresa y clara: finalidad, destinatarios, existencia de la base y su responsable, si es obligatorio responder, consecuencias de no hacerlo y cómo ejercer los derechos. | Debe aparecer en el formulario de inscripción y en una **política de privacidad** pública. | ❌ No existe (`Footer.tsx`, enlaces legales vacíos). |
| **Art. 7** — Datos sensibles | Nadie puede ser obligado a dar datos sensibles; solo pueden tratarse por razones de interés general autorizadas por ley o con fines estadísticos o científicos sin identificar a los titulares. | Pedir el certificado médico requiere una **base clara**: el reglamento de los Juegos (apto físico como requisito de seguridad) y el consentimiento parental. Hay que limitar quién lo ve. | 🟡 El acceso a documentos está restringido por rol y territorio; falta la base escrita. |
| **Art. 9** — Seguridad | El responsable debe adoptar las medidas técnicas y organizativas necesarias para garantizar la seguridad y confidencialidad y evitar adulteración, pérdida, consulta o tratamiento no autorizado. | Todo el relevamiento OWASP y su mitigación son la evidencia de cumplimiento. | 🟡 41 de 47 hallazgos mitigados total o parcialmente. Falta **TLS en producción** (VULN-03), backups probados y plan de incidentes. |
| **Art. 10** — Confidencialidad | Quienes intervienen en el tratamiento están obligados al **secreto profesional**, incluso después de terminada la relación. | Alcanza a los desarrolladores, a los administradores del servidor y al personal de la Secretaría. | ❌ No hay compromiso de confidencialidad firmado. |
| **Art. 11** — Cesión | Los datos solo se ceden con consentimiento, salvo excepciones, entre ellas (inc. 3.c) entre dependencias del Estado en el ejercicio de sus competencias. | Compartir datos con la Secretaría de Deportes de la Nación (etapa nacional de los Juegos), con municipios o con escuelas es una **cesión**. | ⚠️ No está documentado qué se comparte ni con quién. |
| **Art. 12** — Transferencia internacional | Prohibida hacia países sin protección adecuada, salvo excepciones. | Si el servidor, los backups o un servicio externo (correo, nube, CDN) están fuera de Argentina, hay transferencia internacional. | ✅ Se quitaron las fuentes de Google (commit `a29f378`). ⚠️ Falta decidir el alojamiento. |
| **Art. 14** — Derecho de acceso | El titular puede pedir sus datos; el responsable debe responder **dentro de los 10 días corridos**. Gratuito cada 6 meses. | Hace falta un canal (email o formulario) y alguien que responda. | ❌ No existe. |
| **Art. 16** — Rectificación, actualización y supresión | El responsable debe corregir o suprimir **dentro de los 5 días hábiles** del reclamo. | Los datos de un participante deben poder corregirse y borrarse. | 🟡 La administración permite editar; ❌ no hay borrado definitivo con sus documentos. |
| **Art. 21** — Registro | Toda base de datos pública o privada destinada a dar informes debe inscribirse en el registro de la autoridad de control. | Trámite ante la AAIP o el órgano que corresponda en la provincia (⚠️ a confirmar). | ⚠️ Sin constancia. |
| **Art. 22** — Bases públicas | La creación, modificación o supresión de bases de **organismos públicos** debe hacerse por **disposición general publicada en el Boletín Oficial**, indicando finalidad, personas afectadas, procedimiento de obtención, estructura, cesiones, órganos responsables y oficina para ejercer los derechos. | La Secretaría debería dictar una **resolución de creación de la base** publicada en el Boletín Oficial de Formosa. | ❌ No consta. |
| **Art. 31** — Sanciones | Apercibimiento, suspensión, multa, clausura o cancelación de la base. | Riesgo para el organismo; además la responsabilidad civil por daños. | — |

**Normativa complementaria de la AAIP / ex Dirección Nacional de Protección de Datos Personales:**
- **Resolución AAIP 47/2018** (BO 25/07/2018): catálogo de **medidas de seguridad recomendadas** para datos en medios informatizados (Anexo I) y no informatizados (Anexo II), con un procedimiento de **notificación de incidentes**. No es obligatoria, pero la AAIP la usa como estándar al evaluar el cumplimiento del art. 9. Sirve como lista de control para el plan de seguridad del despliegue.
- **Disposición DNPDP 10/2008** ⚠️: exige incluir en los formularios de recolección una leyenda sobre los derechos de acceso, rectificación y supresión y sobre la autoridad de control. Hay que agregarla al formulario de inscripción y a la política de privacidad.

### 4.3 Ley 26.061 de Protección Integral de los Derechos de Niñas, Niños y Adolescentes (reglamentada por el Decreto 415/2006)

| Artículo | Qué dice | Cómo aplica |
|---|---|---|
| **Art. 2** | Aplicación obligatoria en todo acto administrativo respecto de personas de hasta 18 años. | Rige para la Secretaría aunque la provincia no haya adecuado su legislación. |
| **Art. 3** | Interés superior: máxima satisfacción integral y simultánea de sus derechos. | Criterio de decisión ante cualquier duda sobre publicar o conservar datos. |
| **Art. 10** | Derecho a la vida privada e intimidad familiar. | Limita qué datos de contacto y domicilio ven los usuarios del sistema. |
| **Art. 20** | Derecho al deporte y al juego recreativo. | Fundamento del propio programa: justifica tratar los datos necesarios para que participen. |
| **Art. 22** | **Prohíbe exponer, difundir o divulgar datos, informaciones o imágenes que permitan identificar, directa o indirectamente, a niñas, niños y adolescentes** a través de cualquier medio, en contra de su voluntad y la de sus padres o representantes, cuando se lesione su dignidad o reputación o constituyan injerencias en su vida privada. | Es la norma clave para **fixtures, rankings, resultados y noticias con fotos**. Lo seguro es publicar solo lo que la familia autorizó y lo mínimo necesario (por ejemplo, nombre y apellido o iniciales, equipo y departamento, sin DNI, edad exacta ni domicilio). Decide VULN-28. |
| **Art. 24** | Derecho a opinar y a ser oído. | Los adolescentes deberían poder expresar si quieren aparecer en publicaciones, además de la autorización de los padres. |

### 4.4 Código Civil y Comercial de la Nación (Ley 26.994)

- **Art. 25:** menor de edad es quien no cumplió 18 años; adolescente, quien cumplió 13.
- **Art. 26:** los menores ejercen sus derechos por medio de sus representantes, pero con **capacidad progresiva**: el adolescente tiene derecho a ser oído y a participar en las decisiones sobre su persona. Desde los 16 años se lo considera adulto para las decisiones sobre el cuidado de su propio cuerpo. **Para el proyecto:** relevante para el certificado médico y para la autorización de imagen.
- **Art. 51 y 52:** inviolabilidad de la persona y protección de su dignidad, intimidad, honra e imagen.
- **Art. 53 — Derecho a la imagen:** para captar o reproducir la imagen de una persona hace falta su consentimiento (en menores, el de sus representantes), salvo, entre otros casos, que **participe en actos públicos** o que se trate del ejercicio regular del derecho de informar sobre acontecimientos de interés general. **Para el proyecto:** un partido de los Juegos es un acto público, pero en el caso de menores la Ley 26.061 (art. 22) es más estricta. Las fotos en noticias y galerías deberían contar con autorización y nunca ir acompañadas de datos que permitan ubicar al menor.
- **Art. 1770 — Protección de la vida privada:** quien se entromete arbitrariamente en la vida ajena (publicando retratos, difundiendo correspondencia, etc.) debe cesar y puede ser condenado a indemnizar. Es la base de la **responsabilidad civil** si se publica un dato indebido.

### 4.5 Constitución de la Provincia de Formosa

Artículos verificados sobre el texto ordenado sancionado el 7/7/2003 (publicado en el Boletín Oficial el 8/7/2003). En 2025 una Convención Constituyente reformó la Constitución; esa reforma se centró en la reelección (art. 132), pero **la numeración de estos artículos debe confirmarse sobre el texto 2025** (⚠️).

| Artículo | Contenido | Cómo aplica |
|---|---|---|
| **Art. 10** | Todos los habitantes gozan del derecho al **libre acceso a las fuentes de información**. | Fundamento provincial del acceso a la información pública (resultados, estadísticas agregadas), en ausencia de una ley provincial específica. |
| **Art. 12** | Derecho de **réplica o rectificación** y protección contra ataques a la honra, reputación y vida privada y familiar. | Refuerza el derecho a corregir información publicada sobre un participante. |
| **Art. 14** | Inviolabilidad de papeles y comunicaciones; **"quedan asimismo protegidos los datos públicos o privados de los habitantes"**. | Protección constitucional provincial de los datos personales. Es la norma provincial más directa para este sistema. |
| **Art. 69** | La familia y el Estado deben **proteger al niño en forma integral**; el Estado asume una responsabilidad subsidiaria y preventiva. | Refuerza la Ley 26.061 en el ámbito provincial. |
| **Art. 70** | El Estado promueve el **desarrollo integral de los jóvenes**. | Fundamento del programa. |
| **Art. 72** | Derechos de las **personas con capacidades diferentes** a la protección integral y a políticas que desarrollen la conciencia social. | Fundamento provincial para exigir accesibilidad del sistema. |
| **Art. 93, inc. 9** | La política educativa promueve las **actividades recreativas y deportivas** de manera sistematizada. | Fundamento del programa. |

**Legislación provincial relacionada:**
- **Ley 1089/1981** (minoridad) y **Ley II N.º 16 (ex 3820/2002)** ⚠️: las fuentes consultadas indican que la legislación provincial de niñez no se adecuó del todo al modelo de protección integral. No cambia las obligaciones, porque la Ley 26.061 rige directamente.
- **Protección de datos:** no se encontró ley provincial propia ni de adhesión a la Ley 25.326 ⚠️.
- **Acceso a la información pública:** las fuentes consultadas indican que Formosa no tiene ley específica ni adhirió a la Ley 27.275 ⚠️.
- **Accesibilidad web:** no se encontró adhesión de Formosa a la Ley 26.653 ⚠️.

### 4.6 Ley 27.275 de Acceso a la Información Pública (reglamentada por el Decreto 206/2017)

- **Alcance:** obliga al Estado nacional. Formosa no adhirió según las fuentes consultadas; en la provincia rige el art. 10 de su Constitución.
- **Excepciones relevantes (art. 8):** se puede negar la información que contenga **datos personales** cuando no se pueda disociar, y la protegida por secreto.
- **Para el proyecto:** si un ciudadano, un periodista o un concejal pide información sobre los Juegos (cantidad de inscriptos por departamento, resultados, uso de fondos), la Secretaría puede entregarla en forma **agregada y anonimizada**. El módulo de métricas, con su umbral de k-anonimato, ya está pensado para eso. Conviene que el sistema pueda exportar estadísticas sin datos personales.

### 4.7 Ley 26.653 de Accesibilidad de la Información en las Páginas Web (reglamentada por el Decreto 656/2019)

- **Corrección respecto de versiones anteriores de esta documentación:** la primera reglamentación fue el Decreto 355/2013, pero fue **derogado y reemplazado por el Decreto 656/2019**.
- **Alcance:** obliga al Estado nacional y a quienes contratan con él; su art. 12 invita a las provincias a adherir. Varias provincias adhirieron (Chaco, La Rioja, Misiones, Río Negro, CABA); no se encontró adhesión de Formosa ⚠️.
- **Por qué cumplirla igual:** la Convención sobre los Derechos de las Personas con Discapacidad tiene jerarquía constitucional y el art. 72 de la Constitución de Formosa protege a las personas con discapacidad. Además, un sistema que usan familias de todo el territorio, muchas desde el celular, se beneficia directamente.
- **Para el proyecto:** adoptar como meta las pautas **WCAG 2.1 nivel AA** (contraste, navegación con teclado, textos alternativos, formularios con etiquetas y mensajes de error accesibles) y verificarlas en el formulario de inscripción, la encuesta y las páginas públicas.

### 4.8 Ley 26.388 de Delitos Informáticos (modifica el Código Penal) y Ley 27.411 (Convenio de Budapest)

| Artículo del Código Penal | Conducta | Relevancia para el proyecto |
|---|---|---|
| **Art. 153 bis** | Acceso indebido a un sistema o dato informático de acceso restringido. Agravado si es de un organismo público. | Un ataque al sistema es delito; sirve para denunciar incidentes. También alcanza a un usuario interno que entra donde no debe. |
| **Art. 157 bis** | Acceder ilegítimamente a un **banco de datos personales**, revelar información registrada en él que deba mantenerse en secreto, o insertar datos falsos. Agravado para funcionarios públicos. | Alcanza a un empleado o desarrollador que filtre datos de participantes. Refuerza el deber de confidencialidad (art. 10 de la Ley 25.326). |
| **Art. 183, 2.º párrafo** | Daño informático: alterar, destruir o inutilizar datos, documentos o sistemas. | Borrado malicioso o ransomware. |
| **Art. 197** | Interrumpir o entorpecer comunicaciones o un servicio. | Ataques de denegación de servicio durante las inscripciones. |

- **Para el equipo:** las pruebas de seguridad (OWASP ZAP, pentest) se hacen **solo sobre entornos propios o con autorización escrita del responsable**, nunca contra la producción sin permiso.
- **Ley 27.411** aprueba el Convenio de Budapest sobre Ciberdelito: facilita la cooperación y la preservación de evidencia digital si el incidente involucra servicios extranjeros.

### 4.9 Ley 11.723 de Propiedad Intelectual y Ley 25.036 (software)

- La Ley 25.036 incorporó los **programas de computación** como obras protegidas e incluyó una regla para el software hecho por empleados contratados para ese fin, cuya titularidad corresponde al empleador salvo pacto en contrario.
- **Para el proyecto:** el sistema lo desarrollan estudiantes, en el marco de una materia, para un organismo provincial. **No hay relación laboral**, así que la titularidad no está definida por defecto: hay que fijarla por escrito (convenio entre la institución educativa y la Secretaría, o cesión de los autores). Conviene decidir también la **licencia** del código, sobre todo porque el repositorio es público.
- **Dependencias de terceros:** el proyecto usa paquetes open source (MIT, Apache 2.0, etc.). Sus licencias permiten el uso, pero exigen conservar los avisos de copyright. Si alguna dependencia tuviera una licencia copyleft (GPL/AGPL), habría que revisar sus obligaciones.

### 4.10 Ley 25.506 de Firma Digital (reglamentada por el Decreto 182/2019)

- Solo aplica si el sistema llega a emitir documentos con valor legal (certificados de participación firmados, actas de partidos con validez oficial) o a recibir autorizaciones parentales firmadas digitalmente.
- **Hoy no aplica:** la autorización parental se sube como imagen o PDF. Si en el futuro se quiere que tenga valor probatorio pleno, la alternativa es firma digital o una validación presencial.

### 4.11 Normas del programa y del deporte

- **Ley 26.462** (sancionada en diciembre de 2008, promulgada en enero de 2009): instituye el Programa Social y Deportivo **"Juegos Nacionales Evita"** como competencia anual y obliga al Estado nacional a garantizar su realización en coordinación con las provincias. Es el **marco del programa** y la fuente de la finalidad del tratamiento de datos. En 2024–2025 hubo cambios de financiamiento, disciplinas y categorías a nivel nacional ⚠️, que podrían afectar el reglamento y, con él, los datos que se piden.
- **Ley 20.655 del Deporte** (modificada por la Ley 27.202 ⚠️): marco general de la política deportiva.
- **Reglamento de los Juegos** (nacional y provincial): no es una ley, pero define los requisitos de inscripción (edad, apto médico, autorización). **Es la base para justificar cada dato que se pide**: si el reglamento no exige un dato, el sistema no debería pedirlo (art. 4 de la Ley 25.326).

---

## 5. Matriz de cumplimiento

Leyenda: ✅ cumple · 🟡 parcial · ❌ no cumple · ⚠️ sin información.

| # | Requisito | Norma | Estado | Qué falta | Responsable | Prioridad |
|---|---|---|---|---|---|---|
| 1 | Política de privacidad pública | Ley 25.326 art. 6; Disp. 10/2008 | ❌ | Redactarla y publicarla; enlazarla en el pie y en la inscripción | Secretaría (texto) + equipo (página) | **Alta** |
| 2 | Aviso informativo en el formulario de inscripción | Ley 25.326 art. 6 | ❌ | Texto corto con finalidad, responsable y derechos, más casilla de aceptación | Equipo | **Alta** |
| 3 | Autorización parental con alcance definido | Ley 25.326 arts. 5 y 7; Ley 26.061 art. 22; CCyC art. 53 | 🟡 | Modelo único de autorización: datos, certificado médico, imagen y publicación de resultados (por separado) | Secretaría | **Alta** |
| 4 | Criterio de publicación de datos de menores | Ley 26.061 art. 22; CDN art. 16 | ❌ | Decidir qué se publica y aplicarlo en la API pública (VULN-28) | Secretaría (decisión) + equipo | **Alta** |
| 5 | Tratamiento reforzado del certificado médico | Ley 25.326 arts. 2, 7 y 9 | 🟡 | Base escrita en el reglamento; acceso solo para quien lo revisa; plazo de borrado propio | Secretaría + equipo | **Alta** |
| 6 | Plazo de conservación y purga | Ley 25.326 art. 4 inc. 7 | ❌ | Fijar plazos (participantes, documentos, auditoría) y programar el borrado (VULN-27) | Secretaría (plazo) + equipo | **Alta** |
| 7 | Procedimiento de acceso, rectificación y supresión | Ley 25.326 arts. 14 a 16; CN art. 43 | ❌ | Canal de contacto, responsable de responder y función de exportar o borrar todo lo de un participante | Secretaría + equipo | **Alta** |
| 8 | Cifrado en tránsito (TLS) | Ley 25.326 art. 9; Res. AAIP 47/2018 | ❌ | Configurar TLS en producción (VULN-03/11) | Equipo + quien administre el servidor | **Alta** (antes de producción) |
| 9 | Resolución de creación de la base publicada en el BO | Ley 25.326 art. 22 | ❌ | Dictarla y publicarla | Secretaría | Media |
| 10 | Inscripción de la base | Ley 25.326 art. 21 | ⚠️ | Confirmar ante qué registro y hacer el trámite | Secretaría | Media |
| 11 | Compromiso de confidencialidad | Ley 25.326 art. 10; CP art. 157 bis | ❌ | Firmarlo con desarrolladores, administradores y personal con acceso | Secretaría | Media |
| 12 | Registro de cesiones | Ley 25.326 art. 11 | ⚠️ | Documentar qué datos se comparten con Nación, municipios u otros | Secretaría | Media |
| 13 | Alojamiento en el país o con garantías | Ley 25.326 art. 12 | ⚠️ | Decidir dónde se aloja el sistema y los backups | Secretaría + equipo | Media |
| 14 | Plan de respuesta a incidentes | Ley 25.326 art. 9; Res. AAIP 47/2018 Anexo II; Convenio 108+ | ❌ | Procedimiento: detectar, contener, notificar a la autoridad y a los afectados | Equipo + Secretaría | Media |
| 15 | Backups y restauración probados | Ley 25.326 art. 9 | ⚠️ | Backups automáticos de PostgreSQL y MinIO con prueba de restauración | Equipo | Media |
| 16 | Minimización de datos en consultas y reportes | Ley 25.326 art. 4 | 🟡 | Terminar los módulos 6 y 7 del refactor (reportes y listado de participantes) | Equipo | Media |
| 17 | Anonimato real de la encuesta | Ley 25.326 arts. 4 y 7 | 🟡 | Truncar `enviadaEn` a la hora (VULN-35) y tope por IP sin guardar la IP (VULN-20) | Equipo | Media |
| 18 | Medidas de seguridad técnicas | Ley 25.326 art. 9 | 🟡 | Cerrar los hallazgos parciales del relevamiento OWASP | Equipo | Media |
| 19 | Accesibilidad WCAG 2.1 AA | Ley 26.653; CDPD art. 9; Const. Formosa art. 72 | ⚠️ | Auditoría de accesibilidad de las pantallas públicas y del formulario | Equipo | Media |
| 20 | Estadísticas exportables sin datos personales | Ley 27.275; Const. Formosa art. 10 | 🟡 | El módulo de métricas ya aplica k-anonimato; falta un export público si se decide | Equipo | Baja |
| 21 | Titularidad y licencia del código | Leyes 11.723 y 25.036 | ❌ | Convenio o cesión por escrito y elección de licencia | Equipo + institución + Secretaría | Media |
| 22 | Pruebas de seguridad autorizadas | CP arts. 153 bis y 183 | ✅ | Mantener la regla: solo entornos propios o con autorización escrita | Equipo | — |

---

## 6. Decisiones y trámites que corresponden a la Secretaría

El equipo no puede resolver esto: corresponde al **responsable del tratamiento**.

1. **¿Quién es formalmente el responsable de la base de datos?** (área, cargo y datos de contacto, para la política de privacidad).
2. **¿Se dicta una resolución de creación de la base** con publicación en el Boletín Oficial de Formosa (art. 22)? ¿Ante qué registro se inscribe (art. 21)?
3. **¿Qué datos exige el reglamento de los Juegos?** Cada dato que el reglamento no exija debería dejar de pedirse.
4. **Autorización parental:** ¿se usa un modelo único firmado en papel y escaneado, o una aceptación en línea? ¿Cubre por separado datos, certificado médico, fotos y publicación de resultados?
5. **¿Qué se publica de los menores?** (nombre completo o iniciales, foto, edad, departamento, escuela o club). Decide VULN-28.
6. **¿Cuánto tiempo se conservan los datos** después de cada edición de los Juegos? ¿Y los certificados médicos y las imágenes de DNI en particular? ¿Y los registros de auditoría (VULN-27)?
7. **¿Con quién se comparten los datos?** (Secretaría de Deportes de la Nación para la final, municipios, escuelas, aseguradoras).
8. **¿Dónde se aloja el sistema?** (servidores del gobierno provincial, proveedor nacional o nube extranjera).
9. **¿Quién responde los pedidos de acceso, rectificación y supresión?**
10. **¿De quién es el código y quién lo mantiene** cuando el equipo termine la materia?

---

## 7. Tareas técnicas para el equipo

Ordenadas por dependencia. Las que dependen de una decisión de la sección 6 lo indican.

| # | Tarea | Depende de | Relación con el refactor |
|---|---|---|---|
| T1 | Páginas `/privacidad` y `/terminos`, y enlaces en el pie (`Footer.tsx` ya tiene el lugar preparado) | Decisiones 1 y 6 (texto) | Módulo 8 (frontend público) |
| T2 | Aviso informativo y casilla de aceptación en el formulario de inscripción, guardando fecha y versión del texto aceptado | Decisión 4 | Módulo 7; requiere ítem en `spec.md` |
| T3 | Proyección pública separada de la de administración en fixtures y rankings | Decisión 5 | Paso 1.7 (VULN-28) |
| T4 | Purga programada de participantes, documentos (incluidos los archivos en MinIO) y auditoría | Decisión 6 | Paso 2.5 (VULN-27) |
| T5 | Función de administración "exportar todos los datos de un participante" y "suprimir participante" | Decisión 9 | Nueva; requiere ítem en `spec.md` |
| T6 | Acceso al certificado médico restringido al rol que lo revisa y registrado en auditoría | — | Módulo 6 (documentos) |
| T7 | TLS en producción, backups automáticos con prueba de restauración y monitoreo | Decisión 8 | Fuera del refactor (despliegue) |
| T8 | Plan de respuesta a incidentes basado en el Anexo II de la Resolución AAIP 47/2018 | — | Documentación |
| T9 | Auditoría de accesibilidad WCAG 2.1 AA de las pantallas públicas, la inscripción y la encuesta | — | Módulos 7 y 8 |
| T10 | Completar VULN-35 (`enviadaEn` truncada) y VULN-20 (tope por IP sin guardar la IP) | — | Módulo 3 |

---

## 8. Puntos no verificados

Marcados con ⚠️ en el documento. Hay que confirmarlos con el área legal de la Secretaría o en el Boletín Oficial y el digesto de la Legislatura de Formosa antes de citarlos en un documento oficial.

| Punto | Qué se encontró | Qué falta confirmar |
|---|---|---|
| Adhesión de Formosa a la Ley 25.326 | Ninguna fuente la menciona; un artículo de doctrina de 2014 indica que Formosa solo reconoce algunos derechos. | Si existe ley provincial de datos o de adhesión, y ante qué registro se inscriben las bases públicas provinciales. |
| Ley provincial de acceso a la información | Fuentes periodísticas y de doctrina indican que Formosa no tiene ley ni adhirió a la Ley 27.275. | Estado actual en el digesto provincial. |
| Adhesión a la Ley 26.653 | No se encontró. | Estado actual. |
| Legislación provincial de niñez | Ley 1089/1981 y Ley II N.º 16 (ex 3820/2002) aparecen en un informe, sin claridad sobre cuál está vigente. | Norma vigente y si la Constitución 2025 agregó cláusulas sobre niñez. |
| Numeración de la Constitución de Formosa | Los artículos se tomaron del texto de 2003. En 2025 hubo una reforma. | Numeración en el texto 2025 (el PDF oficial no se pudo descargar). |
| Disposición DNPDP 10/2008 | Citada de memoria. | Texto y vigencia. |
| Ley 27.202 (modificación de la Ley 20.655) | Citada de memoria. | Número y alcance. |
| Cambios 2024–2025 en los Juegos Evita | Notas periodísticas sobre recortes y cambios de disciplinas. | Normativa nacional vigente para la edición en curso. |
| Normativa de la Municipalidad de la Ciudad de Formosa | No se relevó. | Solo hace falta si se firma un convenio con el municipio. |

---

## 9. Índice de normas

| Norma | Tema | Reglamentación o normas asociadas | Sección |
|---|---|---|---|
| Constitución Nacional, art. 43 y art. 75 inc. 22 | Hábeas data; tratados con jerarquía constitucional | — | 4.1 |
| Ley 23.849 | Convención sobre los Derechos del Niño | Jerarquía constitucional (art. 75 inc. 22) | 4.1 |
| Ley 26.378 y Ley 27.044 | Convención sobre los Derechos de las Personas con Discapacidad | Jerarquía constitucional por Ley 27.044 | 4.1 |
| Ley 27.483 | Convenio 108 (protección de datos) | — | 4.1 |
| Ley 27.699 | Convenio 108+ | Decreto 792/2022 (promulgación); ratificación 17/04/2023 | 4.1 |
| **Ley 25.326** | Protección de los Datos Personales | **Decreto 1558/2001**; Decreto 746/2017 (AAIP); **Resolución AAIP 47/2018**; Disposición DNPDP 10/2008 ⚠️ | 4.2 |
| **Ley 26.061** | Protección Integral de Niñas, Niños y Adolescentes | **Decreto 415/2006** | 4.3 |
| **Ley 26.994** | Código Civil y Comercial | — | 4.4 |
| **Constitución de Formosa** | Arts. 10, 12, 14, 69, 70, 72 y 93 inc. 9 | Texto 2003, reforma 2025 ⚠️ | 4.5 |
| Ley provincial 1089/1981 y Ley II N.º 16 ⚠️ | Minoridad y niñez (Formosa) | — | 4.5 |
| Ley 27.275 | Acceso a la Información Pública | Decreto 206/2017 | 4.6 |
| Ley 26.653 | Accesibilidad web | **Decreto 656/2019** (derogó el 355/2013) | 4.7 |
| Ley 26.388 | Delitos informáticos | Ley 27.411 (Convenio de Budapest) | 4.8 |
| Ley 11.723 | Propiedad intelectual | Ley 25.036 (software) | 4.9 |
| Ley 25.506 | Firma digital | Decreto 182/2019 | 4.10 |
| Ley 26.462 | Juegos Nacionales Evita | — | 4.11 |
| Ley 20.655 | Deporte | Ley 27.202 ⚠️ | 4.11 |

---

## 10. Fuentes

**Normas (texto oficial):**
- Ley 25.326 — [argentina.gob.ar / InfoLEG](https://servicios.infoleg.gob.ar/infolegInternet/anexos/60000-64999/64790/texact.htm)
- Resolución AAIP 47/2018 — [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/resolución-47-2018-312662/texto) · [Boletín Oficial, 25/07/2018](https://www.boletinoficial.gob.ar/detalleAviso/primera/188654/20180725)
- Obligaciones de los responsables de bases de datos (AAIP) — [argentina.gob.ar](https://www.argentina.gob.ar/node/53779)
- Ley 26.061 y Decreto 415/2006 — [SCBA (PDF)](https://www.scba.gov.ar/servicios/Ley%2026061%20y%20Decreto%20Nac%20415-2006%20(1).pdf)
- Ley 26.653 — [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/175694/texto) · Decreto 656/2019 — [UNC (PDF)](https://www.unc.edu.ar/sites/default/files/Dto-656-19_0.pdf) · [W3C WAI — políticas de Argentina](https://www.w3.org/wai/policies/argentina)
- Ley 27.699 — [texto publicado (PDF)](https://ciberseguridad.uncoma.edu.ar/wp-content/uploads/2024/09/Ley-27699.pdf)
- Ley 26.462 — [argentina.gob.ar](https://www.argentina.gob.ar/normativa/nacional/norma-121348/texto)
- Constitución de la Provincia de Formosa — [argentina.gob.ar (PDF, texto 2003)](https://www.argentina.gob.ar/sites/default/files/01_constitucion_de_la_provincia_de_formosa.pdf) · [texto 2025 en formosa.gob.ar (PDF)](https://m.formosa.gob.ar/modulos/miprovincia/templates/files/constitucion2025.pdf)

**Contexto y doctrina:**
- Convenio 108+ en Argentina — [Marval](https://www.marval.com/Publicacion/argentina-aprueba-y-se-convierte-en-parte-del-convenio-108-14369?lang=es) · [Baker McKenzie](https://insightplus.bakermckenzie.com/bm/data-technology/argentina-congress-approves-the-law-on-ratification-to-the-convention-108)
- Resolución AAIP 47/2018 — [Marval](https://www.marval.com/Publicacion/nueva-resolucion-sobre-medidas-de-seguridad-y-datos-personales-13216)
- Acción de protección de datos en las provincias — [M. Basterra (PDF)](https://marcelabasterra.com.ar/wp-content/uploads/2016/11/La-accion-de-proteccion-de-datos-personales.-HD-2014-link.pdf)
- Acceso a la información en las provincias — [El Auditor](https://elauditor.info/noticias/-como-es-el-acceso-a-la-informacion-publica-en-argentina-_a5d8b9f54edfdc318baf42d3d) · [El Ruido](http://elruido.org/legislatura-formosa-transparencia-corrupcion/)
- Niñez en Formosa — [Diario Norte](https://www.diarionorte.com/336951-formosa-reafirma-su-compromiso-integral-con-los-derechos-de-ninas-ninos-y-adolescentes) · [Infobae / L. Musa](https://opinion.infobae.com/laura-musa/tag/leyes-de-adhesion/index.html)
- Reforma constitucional de Formosa 2025 — [El Cronista](https://www.cronista.com/economia-politica/formosa-elimino-la-reeleccion-indefinida-pero-gildo-insfran-podra-ser-candidato-en-2027) · [BAE Negocios](https://www.baenegocios.com/politica/Elecciones-2025-Formosa-reueva-la-Legislatura-y-define-la-reforma-constitucional-20250627-0074.html)
- Juegos Evita 2024–2025 — [Ámbito](https://www.ambito.com/politica/denuncian-que-el-gobierno-busca-desfinanciar-los-juegos-evita-y-cambiarles-el-nombre-n6006193)

**Documentación del proyecto:**
- [`../seguridad/relevamiento-owasp-2025.md`](../seguridad/relevamiento-owasp-2025.md) — relevamiento OWASP Top 10:2025 (VULN-03, 20, 27, 28, 35, entre otras).
- [`../refactor/README.md`](../refactor/README.md) — estado del refactor y fases donde se resuelven las tareas técnicas.
- `backend/prisma/schema.prisma` — modelo de datos relevado en la sección 2.
- `frontend/src/components/layout/Footer.tsx` — nota sobre la falta de política de privacidad.
