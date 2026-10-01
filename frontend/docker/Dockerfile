# syntax=docker/dockerfile:1.7
# ===========================================
# Juegos Evita — frontend (build de Vite servido por nginx)
# ===========================================
FROM node:22-alpine AS build
WORKDIR /app
ENV npm_config_update_notifier=false npm_config_fund=false npm_config_audit=false
COPY package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci
COPY . .
# Sin VITE_API_BASE_URL el cliente usa `/api/v1` relativo, y nginx lo
# reenvía al backend: una sola dirección, sin CORS.
RUN npm run build
# Precompresión: nginx sirve el .gz ya hecho (gzip_static) con nivel 9, en vez
# de comprimir en cada request con el nivel por defecto.
RUN find dist -type f \( -name '*.js' -o -name '*.css' -o -name '*.html' \
      -o -name '*.svg' -o -name '*.json' -o -name '*.txt' \) -size +1k \
      -exec gzip -9 -k -n {} +

FROM nginx:1.27-alpine
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1/ || exit 1
