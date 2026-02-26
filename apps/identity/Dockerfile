# Build stage
FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY tsconfig*.json ./
COPY src ./src

# Install all dependencies including dev dependencies for building
RUN npm install
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=builder /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/server.js"]
