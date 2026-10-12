FROM node:24-bookworm-slim
RUN node -e "require('fs').mkdirSync('/etc/ssl/certs', { recursive: true }); require('fs').writeFileSync('/etc/ssl/certs/ca-certificates.crt', require('tls').rootCertificates.join('\n'))" \
    && sed -i 's|http://deb.debian.org|https://deb.debian.org|g' /etc/apt/sources.list.d/debian.sources \
    && apt-get -o Acquire::Retries=3 -o Acquire::https::Timeout=20 update \
    && apt-get -o Acquire::Retries=3 -o Acquire::https::Timeout=20 install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*
RUN npm install --global pnpm@10.28.2
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json eslint.config.mjs ./
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api
COPY apps/web/package.json ./apps/web/package.json
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @office-foodie/shared build && pnpm --filter @office-foodie/api build
WORKDIR /app/apps/api
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/main.js"]
