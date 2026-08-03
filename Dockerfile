FROM node:22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
ARG VITE_GIPHY_API_KEY=""
ENV VITE_GIPHY_API_KEY=$VITE_GIPHY_API_KEY
RUN pnpm build

FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    API_HOST=0.0.0.0 \
    API_PORT=8080 \
    STATIC_DIR=/app/apps/web/dist
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/apps/platform-api/package.json ./apps/platform-api/package.json
COPY --from=build /app/apps/platform-api/node_modules ./apps/platform-api/node_modules
COPY --from=build /app/apps/platform-api/dist ./apps/platform-api/dist
COPY --from=build /app/apps/web/dist ./apps/web/dist
COPY --from=build /app/packages ./packages
EXPOSE 8080
CMD ["node", "apps/platform-api/dist/server.js"]
