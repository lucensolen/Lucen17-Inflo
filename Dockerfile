# Lucen17-Inflo backend
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --production || npm install --production
COPY server.js ./
ENV PORT=3000
EXPOSE 3000
CMD ["npm","start"]
