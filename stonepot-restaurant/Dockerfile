# Production Dockerfile for Stonepot Restaurant Service
# Uses Bun runtime for optimal performance

FROM oven/bun:1.1.38-alpine AS base

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json bun.lockb* ./

# Install dependencies
RUN bun install --production --frozen-lockfile

# Copy application code
COPY src ./src

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

# Switch to non-root user
USER nodejs

# Expose port (Cloud Run uses PORT env var)
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production
ENV PORT=8080

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD bun -e "fetch('http://localhost:8080/health').then(r => r.json()).then(() => process.exit(0)).catch(() => process.exit(1))" || exit 1

# Start the server
CMD ["bun", "run", "src/index.js"]
