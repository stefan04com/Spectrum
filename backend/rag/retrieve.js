import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import OpenAI from "openai";
import { ChromaClient } from "chromadb";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config();
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const COLLECTION_NAME = process.env.RAG_COLLECTION || "autism_rag";
const EMBEDDING_MODEL = process.env.RAG_EMBED_MODEL || "text-embedding-3-large";
const COMPLETION_MODEL = process.env.RAG_COMPLETION_MODEL || "gpt-4o-mini";
const MAX_CONTEXTS = Number(process.env.RAG_TOP_K) || 4;
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

function formatPrompt(question, contexts) {
  const contextBlock = contexts
    .map((ctx, idx) => `Source ${idx + 1} (${ctx.source || ctx.id}):\n${ctx.text}`)
    .join("\n\n");

  return `You are an empathetic autism guide for parents.
Use ONLY the information in the provided sources to answer the parent's question.
If the sources do not contain the answer, say you do not have enough information.
Always cite the source numbers you used.

Sources:\n${contextBlock}\n\nQuestion: ${question}\nHelpful answer:`;
}

async function answerWithContexts(question, contexts) {
  const prompt = formatPrompt(question, contexts);
  const response = await openai.chat.completions.create({
    model: COMPLETION_MODEL,
    temperature: 0.4,
    messages: [
      { role: "system", content: "You help parents care for autistic children using curated resources." },
      { role: "user", content: prompt },
    ],
  });

  return response.choices[0]?.message?.content?.trim();
}

async function answerDirectly(question) {
  const fallbackPrompt = `A parent asked: "${question}". Offer warm, concrete guidance for supporting an autistic child even if you only have general knowledge.`;
  const response = await openai.chat.completions.create({
    model: COMPLETION_MODEL,
    temperature: 0.6,
    messages: [
      {
        role: "system",
        content:
          "You are a compassionate autism specialist. Even without sources you must provide practical, encouraging advice. Never say you lack information; instead give best-practice guidance.",
      },
      { role: "user", content: fallbackPrompt },
    ],
  });

  return {
    prompt: fallbackPrompt,
    answer: response.choices[0]?.message?.content?.trim() ?? "",
  };
}

export async function ragSearch(question, { topK = MAX_CONTEXTS } = {}) {
  if (!question?.trim()) {
    throw new Error("Question is required for ragSearch");
  }

  const collection = await chroma.getOrCreateCollection({ name: COLLECTION_NAME });
  const queryEmbedding = await embed(question);
  const result = await collection.query({
    queryEmbeddings: [queryEmbedding],
    nResults: topK,
  });

  const ids = result.ids?.[0] ?? [];
  const documents = result.documents?.[0] ?? [];
  const distances = result.distances?.[0] ?? [];
  const metadatas = result.metadatas?.[0] ?? [];

  const contexts = ids.map((id, index) => ({
    id,
    text: documents[index],
    score: distances[index],
    source: metadatas[index]?.source || id,
  })).filter((ctx) => ctx.text);

  if (!contexts.length) {
    const { prompt: fallbackPrompt, answer: fallbackAnswer } = await answerDirectly(question);
    const normalized = fallbackAnswer.trim();
    const needsNote = !normalized || /not have enough information/i.test(normalized);
    const finalFallback = needsNote
      ? "Nu am găsit context suficient în biblioteca RAG. Întrebarea a fost redirecționată către ChatGPT pentru un răspuns general."
      : normalized;
    return {
      answer: `${finalFallback}\n\n(Prompt trimis către ChatGPT: ${fallbackPrompt})`,
      sources: [],
    };
  }

  const answer = await answerWithContexts(question, contexts);
  return {
    answer,
    sources: contexts,
  };
}