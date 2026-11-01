FROM node:22-bookworm-slim@sha256:4b150b48b4116e2a22f2c39cc27025fbf4f153e2078fd3b14d159fdb5c7279da
WORKDIR /app
COPY package.json package-lock.json ./
# SQLite is built into Node; runtime packages do not need native install scripts.
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force
COPY public ./public
COPY src/server ./src/server
RUN mkdir -p /app/data /app/uploads && chown node:node /app/data /app/uploads
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATA_DIR=/app/data UPLOAD_DIR=/app/uploads
EXPOSE 3000
CMD ["node", "src/server/server.local.js"]
