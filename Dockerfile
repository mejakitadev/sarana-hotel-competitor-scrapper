FROM node:20-slim

# Set working directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install only Firefox + system dependencies
RUN npx playwright install --with-deps firefox

# Copy source code
COPY . /usr/src/app

# Install depedencies
RUN npm install --omit=dev

# Make the start script executable
RUN chmod +x start-server.sh

# Jalankan aplikasi
CMD ["./start-server.sh"]