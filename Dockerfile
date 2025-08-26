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

FROM mcr.microsoft.com/playwright:v1.55.0-noble

# Set working directory
WORKDIR /app

# Install dependencies first (caching layer)
COPY package*.json ./
RUN npm install --omit=dev

# Copy source code
COPY . .

# Set necessary environment variables for running browsers in containers
ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Configure Playwright to run in non-headless mode with additional args
ENV PLAYWRIGHT_LAUNCH_OPTIONS='{"headless": true, "args": ["--no-sandbox", "--disable-dev-shm-usage"]}'

# Jalankan aplikasi
CMD ["node", "hourly-scheduler.js"]