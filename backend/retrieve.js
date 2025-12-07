import OpenAI from "openai";
import { ChromaClient } from "chromadb";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const chroma = new ChromaClient();

//
// ragSearch(query) → find relevant text chunks
//
export async function ragSearch(query) {
  const collection = await chroma.getCollection({ name: "autism_rag" });

  // Convert query to embedding
  const embedding = await client.embeddings.create({
    model: "text-embedding-3-large",
    input: query
  });

  // Semantic search in vector DB
  const result = await collection.query({
    nResults: 5,
    queryEmbeddings: embedding.data[0].embedding
  });

  return result.documents[0]; // array of text fragments
}
