FROM node:24.22.2-alpine3.24 AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.22.2-alpine3.24 AS development
WORKDIR /app
ENV HOST=0.0.0.0 PORT=3000 CHOKIDAR_USEPOLLING=true
COPY --from=dependencies /app/node_modules ./node_modules
COPY --chown=node:node . .
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=20s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:3000').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"]
CMD ["npm", "start"]

FROM node:24.22.2-alpine3.24 AS build
WORKDIR /app
COPY --from=dependencies /app/node_modules ./node_modules
COPY package.json package-lock.json ./
COPY public ./public
COPY src ./src
COPY tailwind.config.js postcss.config.js ./
RUN npm run build
