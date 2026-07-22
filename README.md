# Plataforma Integral de Gestión Juegos Evita Formosa

Este repositorio contiene el código fuente de la plataforma de los Juegos Evita Formosa. El proyecto está dividido en dos partes principales:
- **Backend:** Desarrollado con NestJS, Prisma, PostgreSQL y Redis.
- **Frontend:** Desarrollado con React, Vite y TailwindCSS.

A continuación, encontrarás una guía paso a paso para levantar el proyecto en tu entorno local.

## 📋 Requisitos Previos

Asegúrate de tener instalados los siguientes programas en tu sistema:
- [Node.js](https://nodejs.org/) (Versión 18 o superior recomendada)
- [npm](https://www.npmjs.com/) (Viene incluido con Node.js)
- [Docker y Docker Compose](https://www.docker.com/) (Para levantar la base de datos y otros servicios)

---

## 🚀 Guía de Inicio Rápido (Local)

### 1. Levantar la Infraestructura (Base de Datos, Redis, MinIO)

El backend requiere de PostgreSQL, Redis y MinIO para funcionar. Puedes levantar estos servicios fácilmente utilizando Docker Compose.

1. Abre una terminal.
2. Navega al directorio del backend:
   ```bash
   cd backend
   ```
3. Ejecuta el entorno de desarrollo con Docker Compose:
   ```bash
   docker compose -f docker-compose.dev.yml up -d
   ```
   *Esto descargará las imágenes necesarias (si es la primera vez) e iniciará los contenedores en segundo plano.*

### 2. Configurar e Iniciar el Backend

Con la infraestructura lista, el siguiente paso es preparar y levantar el servidor backend.

1. Estando aún en el directorio `backend`, instala las dependencias:
   ```bash
   npm install
   ```
2. Configura las variables de entorno. Haz una copia del archivo de ejemplo:
   ```bash
   # En Windows (PowerShell/CMD):
   copy .env.example .env
   # En Linux/Git Bash:
   cp .env.example .env
   ```
   *(Revisa el archivo `.env` creado por si necesitas ajustar algún valor, aunque los valores por defecto del `.env.example` deberían coincidir con los de `docker-compose.dev.yml`).*

3. Ejecuta las migraciones de Prisma para crear la estructura de la base de datos:
   ```bash
   npm run db:migrate
   ```
4. *(Opcional)* Si deseas poblar la base de datos con datos de prueba, ejecuta:
   ```bash
   npm run db:seed
   ```
5. Inicia el servidor backend en modo desarrollo:
   ```bash
   npm run start:dev
   ```
   *El backend estará disponible (generalmente en `http://localhost:3000`).*

### 3. Configurar e Iniciar el Frontend

Abre **otra ventana de la terminal** (para dejar corriendo el backend en la anterior).

1. Navega al directorio del frontend desde la raíz del proyecto:
   ```bash
   cd frontend
   ```
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Configura las variables de entorno. Haz una copia del archivo de ejemplo:
   ```bash
   # En Windows (PowerShell/CMD):
   copy .env.example .env
   # En Linux/Git Bash:
   cp .env.example .env
   ```
4. Inicia el servidor de desarrollo de Vite:
   ```bash
   npm run dev
   ```
   *El frontend estará disponible (generalmente en `http://localhost:5173`).*

---

## 🛠 Comandos Útiles

**Backend:**
- `npm run db:studio` - Abre la interfaz gráfica de Prisma para explorar la base de datos.
- `npm run lint` - Ejecuta el linter (ESLint).
- `npm run format` - Ejecuta el formateador de código (Prettier).

**Frontend:**
- `npm run build` - Construye la aplicación para producción.
- `npm run lint` - Ejecuta el linter (oxlint).

## 🛑 Detener el Entorno

Para detener el servidor backend y frontend, simplemente presiona `Ctrl + C` en sus respectivas terminales.

Para detener los contenedores de Docker (bases de datos, etc.), navega al directorio `backend` y ejecuta:
```bash
docker compose -f docker-compose.dev.yml down
```

---

## 👥 Autores

- Ayala, Santiago Tomás
- Colman, Máximo Javier Alexis
- Pereyra Roman, Ramiro
- Zigarán, Lucas Natanael
