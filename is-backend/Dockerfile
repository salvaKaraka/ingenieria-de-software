# Imagen de producción del backend (la usa Railway y el docker-compose local).
# Multi-stage: compilamos en una etapa y copiamos solo lo necesario a la final.

# ---------- Etapa 1: build ----------
FROM node:24-slim AS build
WORKDIR /app
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# npm ci instala exactamente lo del package-lock; el postinstall corre `prisma generate`
RUN npm ci

COPY . .
RUN npm run build

# ---------- Etapa 2: runtime ----------
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist

EXPOSE 3000
# Aplica migraciones pendientes y arranca la API
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main"]
