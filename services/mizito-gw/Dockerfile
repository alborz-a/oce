# Build context: services/mizito-gw. The Mizito frontend mirror (mirror/) is NOT in git; run scripts/fetch-mirror.sh first.
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
COPY server.js ./
COPY lib ./lib
COPY modules ./modules
COPY shim ./shim
COPY shapes ./shapes
COPY scripts ./scripts
COPY mirror ./mirror
RUN find mirror -name '*.bak*' -delete
RUN sh scripts/check-build.sh
ENV PORT=18090 OCE_BASE=http://oce-app:8000 MIZITO_BASE_PATH=/mizito
USER node
EXPOSE 18090
CMD ["node","server.js"]
