# bot/Dockerfile
FROM node:18-alpine

WORKDIR /app

# Install deps (use the root package.json/lock if your bot depends on ../../packages)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy only what the bot needs
COPY bot ./bot
COPY packages ./packages

COPY .env ./.env

ENV NODE_ENV=production
# Keep polling; no webhook needed inside TEE
ENV AUTO_TRADE_INTERVAL_MIN=30

RUN npm install dotenv

CMD ["node", "bot/index.js"]

