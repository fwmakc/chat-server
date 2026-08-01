FROM node:18-alpine AS builder

WORKDIR /app

COPY chat-server/package*.json ./
RUN npm install --legacy-peer-deps --ignore-scripts

COPY chat-server/ .
RUN npm run build

# --- Runner ---

FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/tsconfig.json ./tsconfig.json

ENV NODE_ENV=production
USER node
EXPOSE 3004
HEALTHCHECK --interval=10s --timeout=3s --retries=5 --start-period=15s \
  CMD wget -qO- http://localhost:3004/health || exit 1

CMD ["node", "-r", "tsconfig-paths/register", "dist/main"]
