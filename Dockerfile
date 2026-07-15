FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json .npmrc ./
RUN npm ci

COPY . .
RUN npm run build

---

FROM node:18-alpine AS runner

WORKDIR /app

COPY package*.json .npmrc ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3004

CMD ["node", "dist/main"]
