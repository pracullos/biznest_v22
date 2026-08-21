# Build context is the repo root (pnpm workspace) — see docker-compose.yaml

FROM node:22-slim AS build
WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json tsconfig.json ./
COPY frontend ./frontend

RUN corepack enable && pnpm install --frozen-lockfile

ARG VITE_API_URL
ARG VITE_MAPTILER_KEY
ARG VITE_MAPBOX_TOKEN
ARG VITE_LGU_REGISTER_TOKEN
ENV VITE_API_URL=$VITE_API_URL \
    VITE_MAPTILER_KEY=$VITE_MAPTILER_KEY \
    VITE_MAPBOX_TOKEN=$VITE_MAPBOX_TOKEN \
    VITE_LGU_REGISTER_TOKEN=$VITE_LGU_REGISTER_TOKEN

RUN pnpm --filter frontend build

FROM nginx:alpine AS runtime
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
