# ============================================
# VSL Performance Dashboard - Dockerfile
# Multi-stage build: Node.js + pnpm
# ============================================

# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy dependency files
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/

# Install all dependencies (including dev for build)
RUN pnpm install --frozen-lockfile

# Copy source code
COPY . .

# Build frontend (Vite) and backend (esbuild)
RUN pnpm build

# Stage 2: Production
FROM node:22-alpine AS production

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate

# Copy dependency files and install production only
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy drizzle migrations (needed for DB setup)
COPY drizzle/ ./drizzle/

# Environment
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/ || exit 1

# Start the server
CMD ["node", "dist/index.js"]
