FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/*/package.json packages/
COPY apps/*/package.json apps/

RUN npm install -g npm@latest && \
    npm install

COPY . .

WORKDIR /app/apps/api
RUN npx prisma generate

WORKDIR /app
CMD ["npm", "run", "dev"]
