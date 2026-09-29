# Optional: containerize the whole application (browser + API + WebSocket).
# PostgreSQL is still provided by docker-compose.yml.
FROM node:20-slim AS deps
WORKDIR /srv
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-slim AS build
WORKDIR /srv
COPY --from=deps /srv/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-slim AS runtime
WORKDIR /srv
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY --from=build /srv/.next ./.next
COPY --from=build /srv/node_modules ./node_modules
COPY server.mjs ./
COPY server ./server
COPY lib ./lib
COPY app ./app
COPY components ./components
COPY hooks ./hooks
COPY types ./types
COPY database ./database

EXPOSE 3000
CMD ["npm", "start"]