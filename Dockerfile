FROM node:24-alpine AS builder
WORKDIR /app
COPY package*.json ./
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci
COPY . .
ARG NEXT_PUBLIC_GATEWAY_URL
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_GATEWAY_URL=$NEXT_PUBLIC_GATEWAY_URL
RUN npm run build
RUN npm prune --omit=dev

FROM node:24-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0 PORT=3000
RUN addgroup -S cryptosight && adduser -S cryptosight -G cryptosight
COPY --from=builder --chown=cryptosight:cryptosight /app/node_modules ./node_modules
COPY --from=builder --chown=cryptosight:cryptosight /app/apps/web/.next/standalone ./
COPY --from=builder --chown=cryptosight:cryptosight /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=cryptosight:cryptosight /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=cryptosight:cryptosight /app/apps/web/messages ./apps/web/messages
COPY --from=builder --chown=cryptosight:cryptosight /app/packages ./packages
COPY --from=builder --chown=cryptosight:cryptosight /app/services ./services
COPY --from=builder --chown=cryptosight:cryptosight /app/db ./db
COPY --from=builder --chown=cryptosight:cryptosight /app/scripts ./scripts
COPY --from=builder --chown=cryptosight:cryptosight /app/package.json ./package.json
USER cryptosight
EXPOSE 3000 3001 3002
CMD ["node","apps/web/server.js"]
