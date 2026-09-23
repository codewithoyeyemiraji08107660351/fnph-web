# syntax=docker/dockerfile:1.7
#
# FNPH Kaduna Telepsychiatry web app, production image for Dokploy.
# Builds the static app, serves it with nginx. TLS and /api routing are done
# by Dokploy's proxy in front of this container.

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# Same origin: the proxy sends /api to the backend, so the base URL stays empty.
ARG VITE_API_BASE_URL=https://api.fnphkad.cloud
ARG VITE_FALLBACK_EMERGENCY_NUMBER=08032722243
ARG VITE_FALLBACK_INACTIVITY_MINUTES=30
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_FALLBACK_EMERGENCY_NUMBER=$VITE_FALLBACK_EMERGENCY_NUMBER \
    VITE_FALLBACK_INACTIVITY_MINUTES=$VITE_FALLBACK_INACTIVITY_MINUTES
RUN npm run build

FROM nginx:1.27-alpine
COPY deploy/nginx.container.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1
