# plan.md — Plan técnico arquitectónico

> **Producto:** Plataforma Integral de Gestión — Juegos Evita Formosa
> **Versión:** MVP (V1)
> **Documento hermano:** ver `spec.md` (qué) y `tasks.md` (desglose de trabajo).

Este documento define **CÓMO** se construye el sistema: estructura del monorepo, decisiones arquitectónicas del backend, del frontend y cómo se comunican.

---

## 1. Estructura del monorepo

```
evita/
├── backend/                         # API NestJS (aplicación autónoma)
├── frontend/                        # SPA React + Vite (aplicación autónoma)
├── documentacion/                   # Documentación SDD
│   ├── AGENTS.md
│   ├── spec.md
│   ├── plan.md
│   ├── tasks.md
│   ├── PROCESO.md
│   └── documentation.md             # Documento técnico de referencia extendido
├── .github/
│   └── workflows/                   # CI/CD (lint, test, build)
├── docker-compose.dev.yml           # Infra local (Postgres, Redis, MinIO)
├── docker-compose.yml               # Infra productiva
├── .gitignore
└── README.md
```

**Decisiones:**

- **Sin herramienta de monorepo** (Nx, Turborepo, workspaces). Cada app se maneja independientemente; la coordinación es humana y por documentación. Se revisará si la fricción justifica adoptar workspaces en V2.
- **Sin código compartido por import**. Los tipos del dominio se definen primero en el backend (Prisma es la fuente de verdad) y se replican manualmente en `frontend/src/types/`. Esto evita build systems complejos en el MVP.
- **Documentación como código**: `documentacion/` es parte del repo, versionada junto al código.

---

## 2. Backend — Arquitectura

### 2.1 Filosofía

NestJS con **arquitectura modular por dominio**. Cada dominio (`auth`, `participants`, `inscriptions`, etc.) es un módulo autocontenido con controller, service, DTOs y su propia sección de tests.

### 2.2 Estructura de carpetas

```
backend/
├── prisma/
│   ├── schema.prisma                # Modelo de datos (fuente de verdad)
│   ├── seed.ts                      # Datos iniciales (roles, admin bootstrap)
│   └── migrations/
│
├── src/
│   ├── main.ts                      # Bootstrap: Helmet, CORS, Swagger, prefix /api/v1
│   ├── app.module.ts                # Registra guards/filters/interceptors globales
│   │
│   ├── config/
│   │   ├── index.ts                 # Configuraciones tipadas (app, db, jwt, redis)
│   │   └── config.validation.ts     # Zod schema para process.env
│   │
│   ├── database/
│   │   ├── database.module.ts
│   │   └── prisma.service.ts        # PrismaClient singleton con hooks de shutdown
│   │
│   ├── common/
│   │   ├── constants/               # Enums de roles, grupos, acciones de auditoría
│   │   ├── decorators/              # @Public(), @Roles(), @CurrentUser()
│   │   ├── dto/                     # PaginationQueryDto compartido
│   │   ├── filters/                 # GlobalExceptionFilter
│   │   ├── guards/                  # JwtAuthGuard, RolesGuard
│   │   └── interceptors/            # TransformInterceptor, AuditInterceptor
│   │
│   └── modules/
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── strategies/          # JwtStrategy, RefreshStrategy
│       │   └── dto/
│       ├── users/
│       ├── participants/
│       ├── inscriptions/
│       ├── disciplines/
│       ├── categories/
│       ├── competitions/
│       └── results/
│
├── test/                            # e2e tests
├── docker-compose.dev.yml           # Compose de servicios de infra
├── package.json
└── .env.example
```

### 2.3 Guards globales (orden de ejecución)

Se registran en `app.module.ts` como `APP_GUARD` y se aplican **en cadena** a cada request en el siguiente orden:

1. **`ThrottlerGuard`** — Rate limiting global (default 100 req/min por IP). Se sobreescribe puntualmente con `@Throttle(...)` en endpoints sensibles (auth: 5/15min).
2. **`JwtAuthGuard`** — Extrae y valida el JWT del header `Authorization: Bearer <token>`. Si el endpoint está decorado con `@Public()`, hace bypass.
3. **`RolesGuard`** — Lee el metadata del decorador `@Roles(...)` y verifica que el `user.role` presente en el request esté incluido.

**Contrato con controllers:**

```ts
@Controller('inscriptions')
export class InscriptionsController {
  @Post()
  @Roles(...INSCRIPTION_CREATORS)              // RolesGuard verifica
  create(@Body() dto: CreateInscriptionDto, @CurrentUser() user: UserPayload) { }

  @Get('qr/:qrCode')
  @Public()                                    // JwtAuthGuard hace bypass
  findByQr(@Param('qrCode') qrCode: string) { }
}
```

### 2.4 Interceptors globales

- **`TransformInterceptor`** — Envuelve toda respuesta exitosa en `{ success: true, data, meta }`. Las paginaciones devuelven `meta: { page, pageSize, total, totalPages }`.
- **`AuditInterceptor`** — Detecta métodos anotados con `@Audit(action, entity)` y registra el evento (usuario, timestamp, payload sanitizado) en `AuditLog` de forma asíncrona (no bloquea la respuesta).

### 2.5 Filter global

- **`GlobalExceptionFilter`** — Captura `HttpException`, errores de Prisma (`P2002` → 409, `P2025` → 404) y errores no controlados. Log estructurado con Pino y respuesta uniforme:

```json
{ "success": false, "error": { "code": "CONFLICT", "message": "..." } }
```

### 2.6 Autenticación

- **Access token** JWT firmado con `JWT_SECRET`, expiración 15 minutos, payload: `{ sub, email, role }`.
- **Refresh token** UUID persistido con hash Argon2 en tabla `RefreshToken`, expiración 7 días, rotación en cada uso.
- `AuthService` usa `Argon2` para hashear contraseñas al crear/actualizar usuarios.

### 2.7 Validación

- **DTOs de entrada**: class-validator + class-transformer, activados con `ValidationPipe` global (`{ whitelist: true, forbidNonWhitelisted: true, transform: true }`).
- **Variables de entorno**: Zod schema en `config.validation.ts` ejecutado en el bootstrap; falla si falta alguna variable requerida.

### 2.8 Persistencia y cache

- **PrismaService** es un `@Injectable()` que extiende `PrismaClient` e implementa `OnModuleInit`/`OnModuleDestroy`.
- **Redis** se accede vía `@nestjs/cache-manager` con `cache-manager-redis-yet`. Uso principal en MVP: sesiones/refresh tokens y (en V2) dashboard stats.

---

## 3. Frontend — Arquitectura

### 3.1 Filosofía

SPA React 19 con **separación estricta entre capa de datos y capa de UI**. Los componentes nunca hablan HTTP directamente: siempre consumen hooks de React Query que envuelven llamadas Axios.

### 3.2 Estructura de carpetas

```
frontend/
├── public/
├── src/
│   ├── main.tsx                     # Entry point
│   ├── App.tsx                      # QueryClientProvider, RouterProvider, ThemeProvider, <Toaster />
│   ├── router.tsx                   # Definición de rutas
│   ├── index.css                    # Tailwind base + tokens
│   │
│   ├── api/                         # Capa HTTP pura (sin React)
│   │   ├── client.ts                # Instancia Axios + interceptores (auth, refresh)
│   │   ├── auth.api.ts
│   │   ├── participants.api.ts
│   │   ├── inscriptions.api.ts
│   │   ├── competitions.api.ts
│   │   └── results.api.ts
│   │
│   ├── hooks/                       # Wrappers React Query
│   │   ├── useAuth.ts
│   │   ├── useParticipants.ts
│   │   ├── useInscriptions.ts
│   │   ├── useCompetitions.ts
│   │   └── useResults.ts
│   │
│   ├── store/
│   │   └── auth.store.tsx           # Context + reducer: user, accessToken, isAuthenticated
│   │
│   ├── schemas/
│   │   └── index.ts                 # Schemas Zod para formularios
│   │
│   ├── types/
│   │   └── index.ts                 # Interfaces réplica del backend
│   │
│   ├── lib/
│   │   ├── constants.ts             # ROUTES, límites, enums UI
│   │   └── utils.ts                 # cn(), formatters (fecha, DNI)
│   │
│   ├── components/
│   │   ├── ui/                      # Primitivos (Button, Card, Dialog, Table, Form...)
│   │   ├── layout/                  # PublicLayout, AdminLayout, Sidebar, Header
│   │   └── shared/                  # ProtectedRoute, ErrorBoundary, EmptyState
│   │
│   └── pages/
│       ├── auth/
│       │   └── LoginPage.tsx
│       ├── public/
│       │   └── InscriptionInfoPage.tsx    # Consulta pública por QR
│       └── admin/
│           ├── DashboardPage.tsx
│           ├── ParticipantsPage.tsx
│           ├── InscriptionsPage.tsx
│           ├── CompetitionsPage.tsx
│           └── ResultsPage.tsx
│
├── vite.config.ts
├── tsconfig.json
├── package.json
└── .env.example
```

### 3.3 Capa `src/api/` — Axios

- **`client.ts`** exporta una única instancia `apiClient` con `baseURL = import.meta.env.VITE_API_URL`.
- **Interceptor de request**: adjunta `Authorization: Bearer <accessToken>` leído del store.
- **Interceptor de response**: en 401, intenta `POST /auth/refresh` una sola vez; si falla, expulsa al usuario a `/login` y limpia el store.
- **Cada archivo `<dominio>.api.ts`** exporta funciones puras que devuelven la respuesta desempacada (`.data.data` del envelope del backend), sin lógica React.

```ts
// api/inscriptions.api.ts
export const inscriptionsApi = {
  create: (dto: CreateInscriptionDto) => apiClient.post<Envelope<Inscription>>('/inscriptions', dto).then(r => r.data.data),
  findByQr: (qr: string) => apiClient.get<Envelope<Inscription>>(`/inscriptions/qr/${qr}`).then(r => r.data.data),
};
```

### 3.4 Capa `src/hooks/` — React Query

Cada dominio expone hooks que envuelven `useQuery`/`useMutation`. Convención de `queryKey`: `['<dominio>', <operacion>, ...params]`.

```ts
// hooks/useInscriptions.ts
export const useInscriptionByQr = (qr: string) => useQuery({
  queryKey: ['inscriptions', 'byQr', qr],
  queryFn: () => inscriptionsApi.findByQr(qr),
  enabled: Boolean(qr),
});

export const useCreateInscription = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: inscriptionsApi.create,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['inscriptions'] }),
  });
};
```

**Configuración global** (en `App.tsx`): `staleTime: 60_000`, `retry: 1`, `refetchOnWindowFocus: false`.

### 3.5 Capa `src/components/`

- **`ui/`** — primitivos genéricos wrappers de Radix + Tailwind. Reutilizables, sin lógica de dominio.
- **`layout/`** — estructuras de página: `AdminLayout` incluye `Sidebar + Header + Outlet`.
- **`shared/`** — piezas de dominio reutilizables cross-página (`ProtectedRoute`, `RoleBadge`, `EmptyState`).

### 3.6 Capa `src/pages/`

- Cada página corresponde a una ruta.
- Reglas: **una página no llama Axios directamente**, solo consume hooks. **Una página no importa de otra página**.
- Las páginas admin están dentro de `<ProtectedRoute>` en `router.tsx`; la protección adicional por rol se hace vía prop `allowedRoles`.

### 3.7 Estado global

- **`auth.store.tsx`** — Context API (React 19) con reducer. Contiene: `user`, `accessToken`, `isAuthenticated`. Es el único estado global del MVP.
- El resto del "estado servidor" vive en React Query (caché de queries). No se introduce Zustand/Redux/Jotai en el MVP.
- Estado local de componente (formularios, UI) queda con `useState`/`useReducer` locales.

### 3.8 Formularios

- **React Hook Form** para gestión de estado y validación.
- **Zod** como schema (`schemas/index.ts`) — los mismos schemas alimentan `resolver: zodResolver(schema)`.
- Componentes `Form`, `FormField`, `FormMessage` de `components/ui/form.tsx` (wrapper de RHF + Radix Label).

---

## 4. Contratos entre backend y frontend

### 4.1 Formato de respuesta

Todas las respuestas del backend siguen el envelope:

```json
// Éxito
{ "success": true, "data": <payload>, "meta": <opcional> }

// Error
{ "success": false, "error": { "code": "STRING_CODE", "message": "...", "details": <opcional> } }
```

El frontend desempaca `data` en la capa `api/` para que los hooks y componentes trabajen con tipos limpios.

### 4.2 Paginación

- Query params: `?page=1&pageSize=20`.
- Meta de respuesta: `{ page, pageSize, total, totalPages }`.

### 4.3 CORS

- `ALLOWED_ORIGINS` es una variable de entorno separada por comas leída en `main.ts`.
- En dev: `http://localhost:5173`. En prod: dominios oficiales del Ministerio.

---

## 5. Estrategia de despliegue (referencial, se detalla en V2)

- **Backend**: contenedor Docker construido desde `backend/Dockerfile`, publicado detrás de reverse proxy (Nginx/Caddy) con TLS.
- **Frontend**: build estático servido por Nginx o CDN.
- **DB / Redis**: managed service o Docker en VM dedicada.
- **Migraciones Prisma**: `npx prisma migrate deploy` en el paso de release del pipeline; nunca `migrate dev` en prod.

---

## 6. Decisiones arquitectónicas registradas (ADR resumidos)

| # | Decisión | Motivo |
|---|---|---|
| ADR-01 | Monorepo sin workspaces | Simplicidad para MVP; el equipo es pequeño y las apps son independientes. |
| ADR-02 | Sin tipos compartidos vía import | Evita el overhead de un paquete `shared/` y su build. Se acepta la duplicación controlada. |
| ADR-03 | Un solo Context para auth; React Query para el resto | Reduce complejidad. React Query cubre 90% del estado que serían "acciones globales". |
| ADR-04 | Envelope de respuesta uniforme | Facilita el manejo de errores en frontend y logs consistentes en backend. |
| ADR-05 | Refresh token rotativo persistido | Permite revocación real (soft logout desde admin) sin escalar la complejidad del JWT. |
| ADR-06 | Argon2 sobre bcrypt | Argon2 es el ganador PHC (2015) y recomendado por OWASP; NestJS lo soporta nativo. |
| ADR-07 | Sin MinIO en MVP | El almacenamiento de documentos requiere flujo de validación completo; se difiere a V2. |
