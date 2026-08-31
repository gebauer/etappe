# syntax=docker/dockerfile:1

# --- Stage 1: build the SPA ---
FROM node:20-alpine AS web
WORKDIR /app
# Client-facing service URLs (see .env.example) — optional, Vite falls back
# to public defaults (OpenFreeMap/Photon/Overpass) when unset. Vite only
# exposes VITE_-prefixed vars to the browser bundle, so these plain-named
# build args are re-exported under that prefix right before the build; the
# app's own env var names (BUILD.md §11) stay unprefixed everywhere else.
# Exported conditionally, in the same RUN as the build: an ARG left unset by
# the builder must reach Vite as genuinely undefined, not an empty string —
# the app's `?? fallback` reads would otherwise get "" and lose the default.
ARG TILE_URL
ARG PHOTON_URL
ARG OVERPASS_URL
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN if [ -n "$TILE_URL" ]; then export VITE_TILE_URL="$TILE_URL"; fi; \
    if [ -n "$PHOTON_URL" ]; then export VITE_PHOTON_URL="$PHOTON_URL"; fi; \
    if [ -n "$OVERPASS_URL" ]; then export VITE_OVERPASS_URL="$OVERPASS_URL"; fi; \
    npm run build

# --- Stage 2: PocketBase runtime ---
FROM alpine:3.20 AS runtime
ARG PB_VERSION=0.40.1
# TARGETARCH is provided by BuildKit (amd64 / arm64); default keeps plain builds working.
ARG TARGETARCH=amd64
RUN apk add --no-cache ca-certificates unzip wget

WORKDIR /pb
RUN wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${TARGETARCH}.zip" -O /tmp/pb.zip \
    && unzip /tmp/pb.zip -d /usr/local/bin/ \
    && rm /tmp/pb.zip \
    && chmod +x /usr/local/bin/pocketbase

# App code and the built SPA. pb_data is a mounted volume, not baked in.
COPY pb_hooks ./pb_hooks
COPY pb_migrations ./pb_migrations
COPY --from=web /app/dist ./pb_public
COPY scripts/docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 8090
ENTRYPOINT ["/docker-entrypoint.sh"]
# Explicit dirs so resolution never depends on the binary's location.
CMD ["pocketbase", "serve", \
     "--http=0.0.0.0:8090", \
     "--dir=/pb/pb_data", \
     "--hooksDir=/pb/pb_hooks", \
     "--migrationsDir=/pb/pb_migrations", \
     "--publicDir=/pb/pb_public"]
