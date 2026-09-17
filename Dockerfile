FROM node:22-alpine

WORKDIR /app

COPY package*.json .
RUN npm install

COPY index.html vite.config.js ./
COPY src ./src

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]

