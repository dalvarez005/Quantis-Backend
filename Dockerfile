FROM node:20-alpine
WORKDIR /app

COPY package.json package-lock.json* ./
# Necesario antes de `npm ci`: el postinstall ejecuta `prisma generate`.
COPY prisma ./prisma

RUN npm ci

COPY . .
RUN npx prisma generate

ENV NODE_ENV=production
EXPOSE 5000
CMD ["node", "server.js"]
