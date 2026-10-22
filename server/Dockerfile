FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
RUN mkdir -p /data && chown node:node /data
ENV PORT=8787 DB_FILE=/data/rumo.db
VOLUME /data
EXPOSE 8787
USER node
CMD ["node", "src/index.js"]
