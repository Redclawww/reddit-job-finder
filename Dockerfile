# Multi-stage build
FROM node:22-bookworm-slim AS builder

WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Copy package files
COPY package*.json ./

# Install dependencies required to build TypeScript sources
RUN npm ci

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Keep only runtime dependencies for the production image
RUN npm prune --omit=dev && npm cache clean --force

# Production stage
FROM node:22-bookworm-slim AS production

WORKDIR /app
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Create non-root user
RUN groupadd --gid 1001 nodejs && \
    useradd --uid 1001 --gid nodejs --create-home reddit-notifier

# Copy package files
COPY package*.json ./

# Copy built application and pruned runtime dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules

# Create data directory
RUN mkdir -p /app/data && \
    chown -R reddit-notifier:nodejs /app/data /home/reddit-notifier

# Switch to non-root user
USER reddit-notifier

# Set default environment
ENV NODE_ENV=production
ENV DATABASE_PATH=/app/data/reddit-hire-notifier.sqlite
ENV POLL_INTERVAL_MS=900000

# Start the application
CMD ["node", "dist/index.js"]
