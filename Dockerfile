FROM node:20-alpine AS base

WORKDIR /app

# Install dependencies
COPY package.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/tv-screen/package.json ./apps/tv-screen/
COPY apps/phone-controller/package.json ./apps/phone-controller/

RUN npm install --legacy-peer-deps

# Copy source
COPY packages/ ./packages/
COPY apps/ ./apps/
COPY turbo.json ./

# Build TV screen
RUN cd apps/tv-screen && npx vite build

# Build phone controller
RUN cd apps/phone-controller && npx vite build

# Build server with esbuild (bundles shared package inline)
RUN cd apps/server && npx esbuild src/index.ts --bundle --platform=node --target=node20 --outfile=dist/index.js --packages=external

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

COPY --from=base /app/package.json ./
COPY --from=base /app/apps/server/package.json ./apps/server/
COPY --from=base /app/apps/server/dist/ ./apps/server/dist/
COPY --from=base /app/apps/tv-screen/dist/ ./apps/tv-screen/dist/
COPY --from=base /app/apps/phone-controller/dist/ ./apps/phone-controller/dist/

RUN cd apps/server && npm install --production --legacy-peer-deps

EXPOSE ${PORT:-3001}

CMD ["node", "apps/server/dist/index.js"]
