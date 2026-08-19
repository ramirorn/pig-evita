# AGENTS.md — Reglas base para agentes de IA

> **Proyecto:** Plataforma Integral de Gestión — Juegos Evita Formosa
> **Alcance:** Monorepo (`backend/` + `frontend/`). Estas reglas son de aplicación obligatoria para cualquier agente que escriba, revise o refactorice código en este repositorio.

---

## 1. Principios rectores

1. **Spec-Driven Development (SDD):** ningún cambio funcional se implementa sin que exista un ítem correspondiente en `spec.md` y una tarea en `tasks.md`. Si se detecta una necesidad no documentada, se actualiza la spec primero.
2. **Seguridad por defecto:** todo endpoint es privado salvo que se marque explícitamente `@Public()`. Toda entrada externa se valida con Zod o class-validator. Nunca se loguean secretos, tokens ni datos personales.
3. **Escalabilidad primero:** preferir servicios sin estado, cache explícito en Redis para consultas costosas y paginación obligatoria en cualquier endpoint de listado.
4. **Consistencia sobre creatividad:** seguir los patrones existentes del módulo/carpeta antes de inventar nuevos. Si es necesario romper un patrón, dejarlo justificado en el PR y en `PROCESO.md`.

---

## 2. Stack tecnológico ESTRICTO

> No se aceptan librerías fuera de este listado sin actualizar previamente `AGENTS.md` y `plan.md`.

### Backend

| Categoría | Tecnología | Versión mínima |
|---|---|---|
| Runtime | Node.js | 18 LTS |
| Framework | NestJS | 11 |
| Lenguaje | TypeScript | 5 |
| ORM | Prisma | 7 |
| Base de datos | PostgreSQL | 16 |
| Cache | Redis | 7 |
| Autenticación | Passport + JWT (access + refresh) | — |
| Hashing | Argon2 | 0.44+ |
| Validación | Zod + class-validator / class-transformer | — |
| Seguridad HTTP | Helmet | 8 |
| Rate limiting | @nestjs/throttler | 6 |
| Logging | Pino (JSON en prod, pretty en dev) | — |
| Documentación API | Swagger / OpenAPI (`@nestjs/swagger`) | 11 |
| QR | qrcode | 1.5 |

### Frontend

| Categoría | Tecnología | Versión mínima |
|---|---|---|
| Librería UI | React | 19 |
| Bundler | Vite | 8 |
| Lenguaje | TypeScript | 5+ |
| Estilos | TailwindCSS | 4 |
| Routing | React Router | 8 |
| Data fetching | TanStack React Query | 5 |
| HTTP client | Axios | 1.18 |
| Componentes accesibles | Radix UI primitives | 1.6 |
| Formularios | React Hook Form + Zod | 7 / 4 |
| Iconografía | Lucide React | 1.25+ |
| Notificaciones | Sonner | 2 |
| Linter | oxlint | 1.71+ |

### Infraestructura local

- **Docker Compose** es la **única** forma soportada de levantar PostgreSQL, Redis y MinIO en desarrollo. Está prohibido instalar estos servicios en el host.
- Se usan dos archivos: `docker-compose.dev.yml` (desarrollo) y `docker-compose.yml` (producción).

---

## 3. Convenciones de idioma

| Ámbito | Idioma |
|---|---|
| Nombres de identificadores (variables, funciones, clases, archivos, rutas, tablas, columnas) | **Inglés** |
| Comentarios en el código | **Español** |
| Mensajes de error visibles al usuario final | **Español** |
| Documentación (`documentacion/`, `README.md`, JSDoc de negocio) | **Español** |
| Commits (Conventional Commits) | **Español** |
| Nombres de enums de dominio ya establecidos en Prisma (`PENDIENTE`, `APROBADA`, etc.) | Se conservan en español para no romper la BD existente |

Ejemplo válido:

```ts
// Genera el código QR único de la inscripción y lo persiste
async function generateInscriptionQr(inscriptionId: string): Promise<string> {
  // ...
}
```

---

## 4. Convenciones del monorepo

```
evita/
├── backend/                 # API NestJS (autónomo, package.json propio)
├── frontend/                # SPA React + Vite (autónomo, package.json propio)
├── documentacion/           # SDD: AGENTS, spec, plan, tasks, PROCESO, README fuente
├── .github/                 # Workflows CI/CD
├── docker-compose.dev.yml   # (vive en backend/ pero se referencia desde raíz)
└── README.md                # Guía de inicio rápido del monorepo
```

- Cada aplicación (`backend/`, `frontend/`) tiene su propio `package.json`, `tsconfig.json` y `.env.example`.
- No se comparte código entre backend y frontend vía imports directos. Si un tipo debe compartirse, se define primero en el backend (fuente de verdad) y se replica manualmente en `frontend/src/types/`.
- Los comandos se ejecutan **desde el directorio del proyecto correspondiente** (no desde la raíz).
- No se introducen herramientas de monorepo (Nx, Turborepo, pnpm workspaces) sin decisión previa documentada en `plan.md`.

---

## 5. Convenciones de commits y ramas

- **Conventional Commits** en español: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`, con scope opcional (`feat(auth): ...`).
- Rama principal: `main`. Ramas de trabajo con prefijo del autor: `dev-<nombre>` o feature branches `feat/<slug>`.
- Nunca hacer `push --force` a `main`. Nunca commitear `.env`, `node_modules`, `dist`, ni archivos con secretos.

---

## 6. Reglas de calidad de código

1. **Sin `any` implícito** ni explícito salvo en frontera con librerías sin tipos. Justificar cada `any` con comentario.
2. **Sin console.log** en código productivo. Backend usa Pino (`Logger` de NestJS). Frontend puede usar `console` solo durante desarrollo y debe removerse antes del merge.
3. **DTOs siempre validados** con class-validator (backend) y Zod (frontend). No aceptar `body: any`.
4. **Endpoints paginados**: cualquier `GET /listado` debe aceptar `page` y `pageSize` (usar `PaginationQueryDto` común).
5. **Respuestas consistentes**: el `TransformInterceptor` global envuelve `{ success, data, meta }`. No devolver la entidad cruda.
6. **Manejo de errores**: usar excepciones de NestJS (`BadRequestException`, `NotFoundException`, etc.). No devolver códigos HTTP manualmente.
7. **Prisma**: nunca exponer el cliente directamente en controllers. Toda consulta va a través del `Service` del módulo.
8. **Frontend**: todo fetching pasa por un hook `useXxx` en `src/hooks/` que envuelve React Query. Los componentes no llaman a Axios directamente.
9. **Comentarios**: solo cuando el "por qué" no es obvio. Prohibido comentarios que describan el "qué" (el nombre del identificador ya lo dice).

---

## 7. Reglas de seguridad no negociables

- **RBAC obligatorio**: todo endpoint privado declara `@Roles(...)` con el grupo correspondiente definido en `common/constants/roles.constants.ts`.
- **Contraseñas**: solo Argon2. Nunca almacenar en texto plano ni con MD5/SHA1.
- **JWT**: access token corto (≤ 15 min), refresh token rotativo persistido con hash.
- **Rate limiting**: obligatorio en endpoints de auth (5 intentos / 15 min).
- **CORS**: whitelist explícita por entorno. Nunca `origin: '*'` en producción.
- **Uploads**: validar MIME type y tamaño máximo (5 MB para documentos). Sanitizar nombres de archivo.
- **SQL**: siempre vía Prisma. Prohibido `$queryRawUnsafe` con input del usuario.

---

## 8. Reglas para el agente de IA

1. Antes de escribir código, leer siempre `spec.md`, `plan.md` y `tasks.md` para contextualizar.
2. Al completar una tarea de `tasks.md`, marcarla y proponer al usuario registrar la evidencia en `PROCESO.md`.
3. Si el usuario pide una funcionalidad que no está en `spec.md`, **detenerse y proponer actualizar la spec primero**.
4. Prefiere `Edit` sobre `Write` en archivos existentes; nunca reescribas un archivo completo para cambiar 3 líneas.
5. No introducir dependencias nuevas sin confirmación explícita. Si es imprescindible, actualizar la tabla de la Sección 2.
6. Los comentarios que agregues deben ir en español.
7. En caso de duda entre dos enfoques válidos, elegir el que ya usa el módulo vecino.
