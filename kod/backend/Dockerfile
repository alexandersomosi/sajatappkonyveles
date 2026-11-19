# Kézjegy API + worker image (SPEC §20.2). Build context = kod/ :
#   docker build -f backend/Dockerfile -t kezjegy-api kod/
# The worker uses the same image with `node dist/worker.js`. Node 22 LTS, non-root at runtime.
FROM node:22-slim AS build
WORKDIR /build
ENV npm_config_fund=false npm_config_audit=false npm_config_update_notifier=false

# contracts (copied into each package by scripts/sync-shared.mjs)
COPY shared ./shared

# @kezjegy/ado-motor – pure tax engine
COPY ado-motor/package.json ado-motor/package-lock.json ado-motor/.npmrc ./ado-motor/
RUN cd ado-motor && npm ci
COPY ado-motor ./ado-motor
RUN cd ado-motor && npm run build && npm prune --omit=dev

# @kezjegy/nav-kliens – read-only NAV Online Számla client + demo mock
COPY nav-kliens/package.json nav-kliens/package-lock.json nav-kliens/.npmrc ./nav-kliens/
RUN cd nav-kliens && npm ci
COPY nav-kliens ./nav-kliens
RUN cd nav-kliens && npm run build && npm prune --omit=dev

# backend
COPY backend/package.json backend/package-lock.json backend/.npmrc ./backend/
RUN cd backend && npm ci
COPY backend ./backend
RUN cd backend && npm run build && npm prune --omit=dev

FROM node:22-slim
ENV NODE_ENV=production \
    PORT=8080 \
    FILES_DIR=/data/files \
    LEGAL_DIR=/app/legal \
    FONT_DIR=/app/fonts
# Same relative layout as in kod/: backend/node_modules/@kezjegy/* are relative symlinks to ../ado-motor, ../nav-kliens.
COPY --from=build /build/ado-motor/package.json /app/ado-motor/package.json
COPY --from=build /build/ado-motor/dist /app/ado-motor/dist
COPY --from=build /build/nav-kliens/package.json /app/nav-kliens/package.json
COPY --from=build /build/nav-kliens/dist /app/nav-kliens/dist
COPY --from=build /build/nav-kliens/node_modules /app/nav-kliens/node_modules
COPY --from=build /build/backend/package.json /app/backend/package.json
COPY --from=build /build/backend/node_modules /app/backend/node_modules
COPY --from=build /build/backend/dist /app/backend/dist
COPY --from=build /build/backend/drizzle /app/backend/drizzle
COPY backend/fonts /app/fonts
# Legal texts (kod/jogi): index.json, Markdown, templates, app texts.
COPY jogi/index.json jogi/app_szovegek.json jogi/*.md /app/legal/
COPY jogi/sablonok /app/legal/sablonok
WORKDIR /app/backend
USER node
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:8080/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "dist/index.js"]
