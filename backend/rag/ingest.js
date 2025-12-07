import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

pdfjsLib.GlobalWorkerOptions.workerPort = null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOOKS_DIR = path.join(__dirname, "books");
const CHUNKS_DIR = path.join(__dirname, "chunks");
const STANDARD_FONTS_DIR = path.join(__dirname, "node_modules", "pdfjs-dist", "standard_fonts") + path.sep;

async function extractTextFromPDF(pdfPath) {
  const dataBuffer = await fs.readFile(pdfPath);
  const data = new Uint8Array(dataBuffer.buffer, dataBuffer.byteOffset, dataBuffer.byteLength);
  const pdfDocument = await pdfjsLib.getDocument({
    data,
    standardFontDataUrl: STANDARD_FONTS_DIR,
    useSystemFonts: true,
  }).promise;
  const pageTexts = [];

  for (let pageIndex = 1; pageIndex <= pdfDocument.numPages; pageIndex += 1) {
    const page = await pdfDocument.getPage(pageIndex);
    const { items } = await page.getTextContent();
    const pageText = items.map((item) => (typeof item.str === "string" ? item.str : ""))
      .join(" ")
      .trim();
    if (pageText) {
      pageTexts.push(pageText);
    }
    if (typeof page.cleanup === "function") {
      page.cleanup();
    }
  }

  if (typeof pdfDocument.cleanup === "function") {
    pdfDocument.cleanup();
  }
  if (typeof pdfDocument.destroy === "function") {
    pdfDocument.destroy();
  }

  return pageTexts.join("\n");
}

function chunkText(text, size = 500) {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks = [];

  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size).join(" "));
  }

  return chunks;
}

async function ingestBooks({ chunkSize = Number(process.env.RAG_CHUNK_SIZE) || 500 } = {}) {
  await fs.mkdir(CHUNKS_DIR, { recursive: true });
  await fs.access(BOOKS_DIR).catch(() => {
    throw new Error(`Missing books directory at ${BOOKS_DIR}`);
  });

  const books = await fs.readdir(BOOKS_DIR);

  for (const book of books) {
    const isPdf = book.toLowerCase().endsWith(".pdf");
    if (!isPdf) continue;

    const sourcePath = path.join(BOOKS_DIR, book);
    console.log(`📘 Processing: ${book}`);

    try {
      const text = await extractTextFromPDF(sourcePath);
      const chunks = chunkText(text, chunkSize);

      await Promise.all(
        chunks.map((chunk, index) => {
          const safeBase = book.replace(/\.[^.]+$/, "").replace(/\s+/g, "-");
          const chunkName = `${safeBase}-chunk-${index}.txt`;
          const chunkPath = path.join(CHUNKS_DIR, chunkName);
          return fs.writeFile(chunkPath, chunk, "utf8");
        })
      );

      console.log(`✔ DONE: ${book} → ${chunks.length} chunks`);
    } catch (error) {
      console.error(`❌ Failed on ${book}:`, error.message);
    }
  }
}

ingestBooks();
