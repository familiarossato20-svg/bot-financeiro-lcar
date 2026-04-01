FROM node:18-alpine

# Dependências nativas necessárias para Baileys
RUN apk add --no-cache python3 make g++ git

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 3000

CMD ["node", "src/index.js"]
