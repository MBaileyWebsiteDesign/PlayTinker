# PlayTinker concept site: small production image for Fly.io
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev
COPY . .
USER node
EXPOSE 8080
CMD ["node", "server.js"]
