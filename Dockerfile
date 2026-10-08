FROM node:24-alpine AS builder

WORKDIR /app

COPY chat-server/package*.json ./
# Install against local stubs instead of the git-pinned toolkit and event
# contracts: npm "prepares" git deps by installing their whole devDependency
# tree from the registry just to run `prepare` — slow and network-flaky —
# and reifies stale git entries from the lockfile even after package.json
# changed. Both files are rewritten here; the real packages are copied into
# node_modules right after the install.
RUN mkdir -p toolkit-stub contracts-stub \
    && node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.dependencies['api-server-toolkit']='file:./toolkit-stub';p.dependencies['event-server']='file:./contracts-stub';fs.writeFileSync('package.json',JSON.stringify(p,null,2));const l=JSON.parse(fs.readFileSync('package-lock.json','utf8'));delete l.packages['node_modules/api-server-toolkit'];delete l.packages['node_modules/event-server'];const fix=(d)=>{for(const n of ['api-server-toolkit','event-server']){if(d&&d[n])d[n]=n==='api-server-toolkit'?'file:./toolkit-stub':'file:./contracts-stub';}};fix(p.dependencies);if(l.packages&&l.packages['']){fix(l.packages[''].dependencies);}if(l.dependencies){fix(l.dependencies);}fs.writeFileSync('package-lock.json',JSON.stringify(l,null,2))" \
    && echo '{"name":"api-server-toolkit","version":"0.0.0-stub","dependencies":{"@supercharge/request-ip":"*","prom-client":"*"}}' > toolkit-stub/package.json \
    && echo '{"name":"event-server","version":"0.0.0-stub"}' > contracts-stub/package.json
RUN --mount=type=cache,target=/root/.npm npm install --legacy-peer-deps --ignore-scripts --install-links \
  --fetch-retries=5 --fetch-retry-mintimeout=20000 --fetch-retry-maxtimeout=120000 --fetch-timeout=600000

# Drop the installed stub packages before the source COPY: a host context
# that carries node_modules (local Windows builds) can hold a phantom
# event-server directory at this path, and BuildKit refuses to copy a
# directory over the npm-installed package. CI contexts are clean, so this
# is a no-op there; the real packages are restored right after the prune.
RUN rm -rf node_modules/api-server-toolkit node_modules/event-server

COPY chat-server/ .
# The COPY above restores the original package.json/lock (git-pinned
# toolkit and event contracts) — re-apply the stub rewrite or `npm prune`
# re-resolves the git deps and dies (no git in alpine).
RUN node -e "const fs=require('fs');const p=JSON.parse(fs.readFileSync('package.json','utf8'));p.dependencies['api-server-toolkit']='file:./toolkit-stub';p.dependencies['event-server']='file:./contracts-stub';fs.writeFileSync('package.json',JSON.stringify(p,null,2));const l=JSON.parse(fs.readFileSync('package-lock.json','utf8'));delete l.packages['node_modules/api-server-toolkit'];delete l.packages['node_modules/event-server'];const fix=(d)=>{for(const n of ['api-server-toolkit','event-server']){if(d&&d[n])d[n]=n==='api-server-toolkit'?'file:./toolkit-stub':'file:./contracts-stub';}};fix(p.dependencies);if(l.packages&&l.packages['']){fix(l.packages[''].dependencies);}if(l.dependencies){fix(l.dependencies);}fs.writeFileSync('package-lock.json',JSON.stringify(l,null,2))"
# Prune first (drops devDependencies, normalizes the git deps to stubs),
# then put the real packages back and compile with a globally installed
# typescript — prune removes the local one, and `npx tsc` without it
# installs the bogus `tsc` package.
RUN npm prune --production --legacy-peer-deps
RUN rm -rf node_modules/api-server-toolkit node_modules/event-server \
  && npm install -g --no-audit --no-fund typescript@$(node -p "require('./package-lock.json').packages['node_modules/typescript'].version")
COPY api-server-toolkit/package.json ./node_modules/api-server-toolkit/package.json
COPY api-server-toolkit/dist ./node_modules/api-server-toolkit/dist
COPY event-server/package.json ./node_modules/event-server/package.json
COPY event-server/dist/contracts ./node_modules/event-server/dist/contracts
RUN tsc -p tsconfig.build.json

# --- Runner ---

FROM node:24-alpine AS runner

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
