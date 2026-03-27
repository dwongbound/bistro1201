FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm install

COPY index.html ./
COPY public ./public
COPY vite.config.js ./
COPY babel.config.cjs ./
COPY jest.config.cjs ./
COPY playwright.config.js ./
COPY src ./src

EXPOSE 5173

CMD ["npm", "run", "dev"]
