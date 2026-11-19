# Production image for the Mundo-3D backend (Northflank / container hosts).
# Preserves the existing deploy:start pipeline (env preflight, migrations, compiled server).
FROM node:22-bookworm-slim AS build

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY patches patches
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
COPY e2e/package.json e2e/package.json

# Install only the backend workspace and its workspace dependencies from the
# committed lockfile. Development dependencies remain available for tsc.
RUN pnpm install --frozen-lockfile --filter backend...

# Copy only build inputs; local environment files and certificates stay excluded
# via .dockerignore and never enter either image stage.
COPY backend/index.js backend/index.js
COPY backend/openapi.json backend/openapi.json
COPY backend/tsconfig.json backend/tsconfig.build.json backend/
COPY backend/src backend/src
COPY scripts/deploy scripts/deploy

RUN pnpm --filter backend build \
  && pnpm --filter backend deploy --legacy --prod /opt/backend \
  && CI=true pnpm install --prod --frozen-lockfile --filter backend...

FROM node:22-bookworm-slim AS runtime

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@11.0.9 --activate

# Retain the workspace shape because deploy:start invokes root deploy scripts,
# which in turn run pnpm --filter backend commands from /app.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY --from=build /app/patches patches
COPY --from=build /app/node_modules node_modules
COPY --from=build /opt/backend backend
COPY --from=build /app/backend/dist backend/dist
COPY --from=build /app/backend/openapi.json backend/openapi.json
COPY --from=build /app/backend/src/database backend/src/database
COPY --from=build /app/scripts/deploy scripts/deploy

ENV NODE_ENV=production \
    RUN_COMPILED=true \
    PORT=10000 \
    pnpm_config_verify_deps_before_run=false

EXPOSE 10000

WORKDIR /app/backend

CMD ["pnpm", "--filter", "backend", "deploy:start"]
