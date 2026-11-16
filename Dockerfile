# syntax=docker/dockerfile:1
# KıbrısRandevu — tek imaj, iki rol: web (varsayılan) ve worker (`pnpm worker`).
# Aşamalar: deps (kilit dosyası + kurulum) → build (prisma generate + next build) → runner (root olmayan kullanıcı).
ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS base
ENV COREPACK_HOME=/opt/corepack NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
 && apt-get clean && find /var/lib/apt/lists -type f -delete \
 && corepack enable && corepack prepare pnpm@10.28.0 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY prisma ./prisma
# postinstall `prisma generate` şemayı ister, bu yüzden prisma/ önce kopyalanır
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Derleme sırasında sır gerekmez (çalışma zamanında zorunlu); bu sahte değerler yalnız bu aşamada kalır
RUN NEXTAUTH_SECRET=build-only-not-a-secret DATABASE_URL=postgresql://build:build@localhost:5432/build pnpm build \
 && cp -r .next/static .next/standalone/.next/static \
 && find .next/cache -mindepth 1 -delete

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
# Web: standalone sunucu. Worker/migrate/seed: tam node_modules + kaynak (tsx, prisma CLI gerekir).
COPY --from=build --chown=node:node /app /app
COPY --chown=node:node docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=40s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["web"]
