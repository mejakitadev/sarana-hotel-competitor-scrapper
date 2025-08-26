# Stage 1: build dependencies
# FROM node:20-bookworm AS builder

# WORKDIR /app

# # Copy only package.json & package-lock.json (kalau ada)
# COPY package*.json ./

# # Install dependencies (hanya prod)
# RUN npm install --omit=dev

# # Stage 2: runtime
# # FROM mcr.microsoft.com/playwright:v1.55.0-noble
# RUN npx playwright install --with-deps firefox

# WORKDIR /app

# # Copy node_modules dari builder
# COPY --from=builder /app/node_modules ./node_modules

# # Copy semua source code (tanpa node_modules lokal)
# COPY . .

FROM node:20-slim

# Set working directory
WORKDIR /app

# Install dependencies first (caching layer)
COPY package*.json ./
RUN npm install --omit=dev

# Install only Firefox + system dependencies
RUN npx playwright install --with-deps firefox

# Copy source code
COPY . .

# Make the start script executable
RUN chmod +x start-server.sh

# Jalankan aplikasi
CMD ["./start-server.sh"]