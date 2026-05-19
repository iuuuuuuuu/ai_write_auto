FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV DB_TYPE=sqlite
ENV DB_SQLITE_PATH=/app/data/novel.db
ENV HOST=0.0.0.0
ENV PORT=3000

EXPOSE 3000

VOLUME ["/app/data"]

CMD ["node", ".output/server/index.mjs"]
