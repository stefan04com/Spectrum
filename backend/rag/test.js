import { ragSearch } from "./retrieve.js";

const demo_question = "What are some effective strategies for helping my autistic child with social interactions?";
const question = process.argv.slice(2).join(" ") || "“What can I do to help my child feel less stressed?";

try {
	const result = await ragSearch(question);
	console.log("Question:", question);
	console.log("Answer:\n", result.answer);
	console.log("\nSources:");
	result.sources.forEach((source, index) => {
		console.log(`  [${index + 1}] ${source.source} (score: ${source.score?.toFixed?.(3) ?? "n/a"})`);
	});
} catch (error) {
	console.error("Test RAG query failed:", error.message);
	process.exitCode = 1;
}
