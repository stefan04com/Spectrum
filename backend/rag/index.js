import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";
import { ChromaClient } from "chromadb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.join(__dirname, "..", ".env") });
const CHUNKS_DIR = path.join(__dirname, "chunks");
const COLLECTION_NAME = process.env.RAG_COLLECTION || "autism_rag";
const EMBEDDING_MODEL = process.env.RAG_EMBED_MODEL || "text-embedding-3-large";
const OPENAI_API_KEY =
  process.env.OPENAI_API_KEY ||
  process.env.OPEN_API_KEY ||
  process.env.OPEN_AI_KEY ||
  "add_key_here";

if (!OPENAI_API_KEY) {
  throw new Error("Missing OpenAI credentials. Set OPENAI_API_KEY or OPEN_API_KEY in your environment.");
}

const openai = new OpenAI({ apiKey: OPENAI_API_KEY });
const chroma = process.env.CHROMA_URL
  ? new ChromaClient({ path: process.env.CHROMA_URL })
  : new ChromaClient();

async function embed(text) {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text
  });

  return response.data[0].embedding;
}

function parseMetadataFromFilename(filename) {
  const base = filename.replace(/\.txt$/i, "");
  const [rawSource, chunkLabel] = base.split("-chunk-");
  const source = rawSource?.replace(/[-_]/g, " ") ?? "Unknown source";
  const chunkIndex = Number(chunkLabel ?? 0);
  return {
    source,
    chunk_index: Number.isNaN(chunkIndex) ? 0 : chunkIndex,
  };
}

async function getExistingIds(collection) {
  try {
    const existing = await collection.get();
    return new Set(existing.ids ?? []);
  } catch (error) {
    console.warn("⚠️ Unable to fetch existing ids:", error.message);
    return new Set();
  }
}

async function indexChunks() {
  await fs.access(CHUNKS_DIR).catch(() => {
    throw new Error(`Chunks directory not found at ${CHUNKS_DIR}. Run ingest.js first.`);
  });

  const collection = await chroma.getOrCreateCollection({ name: COLLECTION_NAME });
  const chunkFiles = (await fs.readdir(CHUNKS_DIR)).filter((file) => file.endsWith(".txt"));

  if (!chunkFiles.length) {
    console.log("No chunk files detected. Run ingest.js before indexing.");
    return;
  }

  const existingIds = await getExistingIds(collection);
  let indexedCount = 0;

  for (const file of chunkFiles) {
    if (existingIds.has(file)) {
      continue;
    }

    const text = await fs.readFile(path.join(CHUNKS_DIR, file), "utf8");
    const vector = await embed(text);
    const metadata = parseMetadataFromFilename(file);

    await collection.add({
      ids: [file],
      embeddings: [vector],
      documents: [text],
      metadatas: [metadata],
    });

    indexedCount += 1;
    console.log(`✔ Indexed chunk: ${file}`);
  }

  console.log(`🎉 Indexing complete. ${indexedCount} new chunks added (collection: ${COLLECTION_NAME}).`);
}

indexChunks().catch((error) => {
  console.error("❌ Indexing failed:", error);
  process.exitCode = 1;
});
