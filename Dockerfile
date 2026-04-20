# Multi-stage build
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies required to build TypeScript sources
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Production stage
FROM node:22-bookworm-slim AS production

WORKDIR /app
ENV PUPPETEER_CACHE_DIR=/home/reddit-notifier/.cache/puppeteer

RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgbm1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --create-home reddit-notifier

RUN mkdir -p /home/reddit-notifier/.cache/puppeteer && \
    chown -R reddit-notifier:nodejs /home/reddit-notifier

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy built application
COPY --from=builder /app/dist ./dist

# Create data directory
RUN mkdir -p /app/data && \
    chown -R reddit-notifier:nodejs /app/data /home/reddit-notifier

# Switch to non-root user
USER reddit-notifier

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })" || exit 1

# Expose port
EXPOSE 3000

# Set default environment
ENV NODE_ENV=production
ENV STORE_TYPE=sqlite
ENV SQLITE_PATH=/app/data/seen_posts.db
ENV PORT=3000

# Start the application
CMD ["node", "dist/index.js"]
