FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/*/package.json packages/
COPY apps/web/package.json apps/web/

RUN npm install

COPY . .

WORKDIR /app/apps/web
RUN npm run build

FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/apps/web/.next ./.next
COPY --from=builder /app/apps/web/public ./public
COPY --from=builder /app/apps/web/package.json ./
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "start"]
