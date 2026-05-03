ARG NODE_IMAGE=node:22-alpine
ARG NGINX_IMAGE=nginx:alpine

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

ARG APP_NAME=web

RUN pnpm turbo run build --filter=${APP_NAME}

FROM us-docker.pkg.dev/pipeline-corporativo/base-images/latam-nginx-1:stable AS runner

ARG APP_NAME=web
ARG PORT=8080

EXPOSE ${PORT}

# Copy files with nginx user ownership
COPY --from=builder --chown=nginx:nginx /app/apps/${APP_NAME}/dist /opt/app-root/src
COPY --from=builder --chown=nginx:nginx /app/apps/${APP_NAME}/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder --chown=nginx:nginx /app/apps/${APP_NAME}/security-headers.conf /etc/nginx/conf.d/security-headers.conf
COPY --from=builder --chown=nginx:nginx /app/apps/${APP_NAME}/public/config.js.template ./config.js.template
COPY --from=builder --chown=nginx:nginx /app/apps/${APP_NAME}/entrypoint.sh ./entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
