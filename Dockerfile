# syntax=docker/dockerfile:1

# --- Stage 1: build the SPA ---
FROM node:20-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

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

EXPOSE 8090
# Explicit dirs so resolution never depends on the binary's location.
CMD ["pocketbase", "serve", \
     "--http=0.0.0.0:8090", \
     "--dir=/pb/pb_data", \
     "--hooksDir=/pb/pb_hooks", \
     "--migrationsDir=/pb/pb_migrations", \
     "--publicDir=/pb/pb_public"]
