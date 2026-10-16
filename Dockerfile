FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json server.js ./
COPY public ./public
RUN mkdir -p uploads output && chown -R node:node /app
USER node
ENV NODE_ENV=production PORT=3000 MAX_UPLOAD_GB=5
EXPOSE 3000
CMD ["node", "server.js"]
