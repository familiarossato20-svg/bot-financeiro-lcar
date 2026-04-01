FROM node:20-bookworm-slim

# Instala dependências nativas necessárias para o Baileys
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

# Cria pasta de autenticação
RUN mkdir -p auth_info

EXPOSE 3000

CMD ["node", "src/index.js"]
