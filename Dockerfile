FROM node:18-alpine AS builder

WORKDIR /app

# Build @lms/common → tarball at /shared/lms-common-1.0.0.tgz
COPY shared/package*.json shared/tsconfig.json shared/.npmignore /shared/
COPY shared/src/ /shared/src/
RUN cd /shared && npm install && npm run build && npm pack

# Install deps (file:../shared/lms-common-1.0.0.tgz resolves to /shared/)
COPY chat-server/package*.json chat-server/.npmrc ./
RUN node -e "const fs=require('fs'),p='package-lock.json',l=JSON.parse(fs.readFileSync(p));if(l.packages&&l.packages['node_modules/@lms/common'])delete l.packages['node_modules/@lms/common'].integrity;fs.writeFileSync(p,JSON.stringify(l,null,2))" && npm ci

# Build service
COPY chat-server/ ./
RUN npm run build

# --- Runner ---

FROM node:18-alpine AS runner

WORKDIR /app

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 3004

CMD ["node", "dist/main"]