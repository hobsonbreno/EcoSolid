# Build stage
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json tsconfig.build.json ./
COPY src/ src/

RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

COPY --from=builder /app/dist/ ./dist/
COPY package*.json ./
RUN npm ci --omit=dev

EXPOSE 3005

CMD ["node", "dist/main.js"]
