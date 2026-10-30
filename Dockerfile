FROM node:22-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY server ./server
EXPOSE 8787
CMD ["npx", "tsx", "server/index.ts"]
