# Juegos Evita Formosa — Plataforma Integral de Gestión

Sistema web para la **Secretaría de Deportes de la Provincia de Formosa** que digitaliza y centraliza la gestión de los Juegos Evita: inscripciones con QR, competencias, resultados, participantes y roles.

> Este README es la **guía de inicio rápido** para levantar el entorno de desarrollo. La documentación completa vive en [`documentacion/`](./documentacion/) siguiendo la metodología SDD.

---

## 📚 Documentación

| Archivo | Propósito |
|---|---|
| [`AGENTS.md`](./AGENTS.md) | Reglas base y stack tecnológico estricto |
| [`spec.md`](./spec.md) | Especificación del MVP (historias de usuario, criterios de aceptación, out of scope) |
| [`plan.md`](./plan.md) | Plan técnico arquitectónico |
| [`tasks.md`](./tasks.md) | Desglose de tareas atómicas del MVP |
| [`PROCESO.md`](./PROCESO.md) | Bitácora del desarrollo (prompts, código, correcciones) |
| [`documentation.md`](./documentation.md) | Documento técnico extendido de referencia |

---

## 🧱 Stack

**Backend:** Node.js 18+, NestJS 11, TypeScript, Prisma 7, PostgreSQL 16, Redis 7
**Frontend:** React 19, Vite 8, TypeScript, TailwindCSS 4, React Router 8, TanStack Query 5, Axios
**Infra local:** Docker Compose

Ver detalle completo y versiones en [`AGENTS.md`](./AGENTS.md#2-stack-tecnológico-estricto).

---

## ✅ Requisitos previos

- **Node.js** ≥ 18 LTS (`node -v`)
- **npm** ≥ 9 (`npm -v`)
- **Docker Desktop** con Compose v2 (`docker compose version`)
- **Git** (`git --version`)

---

## 🚀 Inicio rápido (5 pasos)

### 1. Clonar y posicionarse

```powershell
git clone <url-del-repo> evita
cd evita
```

### 2. Levantar la infraestructura (PostgreSQL + Redis)

```powershell
docker compose -f docker-compose.dev.yml up -d
```

Verificar que ambos contenedores estén sanos:

```powershell
docker compose -f docker-compose.dev.yml ps
```

### 3. Configurar y arrancar el **backend**

```powershell
cd backend
cp .env.example .env       # (o Copy-Item .env.example .env en PowerShell)
npm install
npx prisma migrate dev     # crea la BD y aplica migraciones
npx prisma db seed         # inserta usuario SUPER_ADMIN bootstrap
npm run start:dev
```

- API disponible en: **http://localhost:3000/api/v1**
- Swagger: **http://localhost:3000/api/docs**

### 4. Configurar y arrancar el **frontend** (en otra terminal)

```powershell
cd frontend
cp .env.example .env
npm install
npm run dev
```

- App disponible en: **http://localhost:5173**

### 5. Login

Usar las credenciales del `SUPER_ADMIN` insertado por el seed (ver `backend/prisma/seed.ts`).

---

## 🐳 Docker Compose — comandos frecuentes

```powershell
# Levantar en background
docker compose -f docker-compose.dev.yml up -d

# Ver logs en vivo
docker compose -f docker-compose.dev.yml logs -f

# Detener sin borrar datos
docker compose -f docker-compose.dev.yml stop

# Detener y eliminar contenedores (mantiene volúmenes)
docker compose -f docker-compose.dev.yml down

# Detener y eliminar TAMBIÉN los volúmenes (borra la BD)
docker compose -f docker-compose.dev.yml down -v
```

**Servicios definidos:**

| Servicio | Puerto host | Notas |
|---|---|---|
| `postgres` | 5432 | Versión 16, volumen persistente |
| `redis` | 6379 | Versión 7 alpine |

> **Fuera de alcance MVP:** MinIO se difiere a V2, por lo tanto no está incluido en `docker-compose.dev.yml` del MVP.

---

## 🗃️ Prisma — comandos frecuentes

Todos se ejecutan desde `backend/`:

```powershell
# Crear una nueva migración a partir de cambios en schema.prisma
npx prisma migrate dev --name <nombre_descriptivo>

# Aplicar migraciones sin generar nuevas (usar en producción/CI)
npx prisma migrate deploy

# Regenerar el cliente Prisma después de cambiar schema.prisma
npx prisma generate

# Abrir Prisma Studio (GUI de la BD)
npx prisma studio

# Ejecutar el seed
npx prisma db seed

# Resetear completamente la BD (borra datos y reaplica migraciones + seed)
npx prisma migrate reset
```

---

## ⚙️ Variables de entorno

Cada aplicación tiene su `.env.example` como plantilla. Las variables mínimas requeridas:

### Backend (`backend/.env`)

```env
# App
NODE_ENV=development
PORT=3000
ALLOWED_ORIGINS=http://localhost:5173

# Database
DATABASE_URL=postgresql://evita:evita@localhost:5432/evita

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=cambiar-esto-en-produccion
JWT_EXPIRES_IN=15m
JWT_REFRESH_SECRET=cambiar-esto-tambien
JWT_REFRESH_EXPIRES_IN=7d

# Throttle
THROTTLE_TTL=60
THROTTLE_LIMIT=100

# Seed
SEED_ADMIN_EMAIL=admin@evita.gob.ar
SEED_ADMIN_PASSWORD=CambiarInmediatamente!
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:3000/api/v1
```

> **No commitear `.env`.** El `.gitignore` global ya lo excluye.

---

## 🧪 Scripts útiles

### Backend

```powershell
npm run start:dev     # server con hot reload
npm run build         # compila a dist/
npm run start:prod    # arranca la build
npm run lint          # ESLint
npm run format        # Prettier
npm run test          # tests unitarios
npm run test:e2e      # tests e2e
```

### Frontend

```powershell
npm run dev           # dev server con HMR
npm run build         # build de producción
npm run preview       # sirve la build local
npm run lint          # oxlint
```

---

## 🗂️ Estructura del monorepo

```
evita/
├── backend/                 # API NestJS
├── frontend/                # SPA React + Vite
├── documentacion/           # SDD (spec, plan, tasks, PROCESO, AGENTS)
├── .github/workflows/       # CI/CD
├── docker-compose.dev.yml   # Infra local
└── README.md
```

Detalle completo por carpeta en [`plan.md`](./plan.md#1-estructura-del-monorepo).

---

## 🔒 Seguridad

- Contraseñas hasheadas con **Argon2**.
- Autenticación JWT con access + refresh token rotativo.
- Rate limiting global (`@nestjs/throttler`) y estricto en `/auth/login` (5/15min).
- **Helmet** activo, CORS con whitelist explícita por entorno.
- RBAC obligatorio en todos los endpoints privados vía `@Roles(...)`.

Ver [`AGENTS.md#7`](./AGENTS.md#7-reglas-de-seguridad-no-negociables).

---

## 🧭 ¿Por dónde empiezo si soy nuevo en el proyecto?

1. Leer [`spec.md`](./spec.md) — entender **qué** hace el sistema.
2. Leer [`plan.md`](./plan.md) — entender **cómo** está construido.
3. Leer [`AGENTS.md`](./AGENTS.md) — internalizar las reglas del código.
4. Seguir la **Sección "Inicio rápido"** de este README.
5. Consultar [`tasks.md`](./tasks.md) para ver el estado de avance.
6. Registrar todo cambio significativo en [`PROCESO.md`](./PROCESO.md).

---

## 👥 Autores

- Ayala, Santiago Tomás
- Colman, Máximo Javier Alexis
- Pereyra Roman, Ramiro
- Zigarán, Lucas Natanael

---

## 📄 Licencia

Uso interno de la **Secretaría de Deportes de la Provincia de Formosa**.
