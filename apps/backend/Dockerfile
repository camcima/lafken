ARG NODE_IMAGE=node:22-alpine

FROM ${NODE_IMAGE} AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

FROM base AS builder

RUN apk add --no-cache libc6-compat python3 make g++

COPY json/ .

RUN pnpm install --frozen-lockfile

COPY full/ .

ARG APP_NAME=backend

RUN pnpm turbo run build --filter=${APP_NAME} --filter="./shared/*"
# Remove the transpiled `src/scripts` folder to avoid copying it to the runner image
RUN rm -rf ./dist/scripts/

FROM us-docker.pkg.dev/pipeline-corporativo/base-images/latam-nodejs-22:stable AS runner

ENV NODE_ENV=production

ARG APP_NAME=backend
ARG PORT=3000
ARG METRICS_PORT=9464

ENV PORT=${PORT}

EXPOSE ${PORT} ${METRICS_PORT}

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/shared ./node_modules/@shared
COPY --from=builder /app/apps/${APP_NAME}/scripts/display-vault-secrets.mjs ./scripts/display-vault-secrets.mjs
COPY --from=builder /app/apps/${APP_NAME}/deploy/run/vault-secrets-config.mjs ./deploy/run/vault-secrets-config.mjs
COPY --from=builder /app/apps/${APP_NAME}/dist ./dist
COPY --from=builder /app/apps/${APP_NAME}/entrypoint.sh ./entrypoint.sh
COPY --from=builder /app/apps/${APP_NAME}/db/migrations ./db/migrations

# Set the entrypoint to run the migrations and then the app
ENTRYPOINT ["./entrypoint.sh"]