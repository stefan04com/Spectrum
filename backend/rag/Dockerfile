FROM node:18-bullseye

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

ENV RAG_COLLECTION=autism_rag \
    RAG_EMBED_MODEL=text-embedding-3-large \
    RAG_CHUNK_SIZE=500 \
    CHROMA_URL=http://chroma:8000

CMD ["tail", "-f", "/dev/null"]
