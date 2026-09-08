import { MockExtractionAdapter } from "./mock-adapter";
import { GoogleDocumentAIAdapter, LLMExtractionAdapter, VisionOCRAdapter } from "./placeholder-adapters";
import { GeminiExtractionAdapter } from "./gemini-adapter";
import type { DocumentExtractionAdapter } from "./types";

export * from "./types";
export { FIELD_DEFINITIONS, FIELD_GROUP_LABELS, FIELD_LABELS } from "./fields";

const adapters: Record<string, DocumentExtractionAdapter> = {
  mock: new MockExtractionAdapter(),
  "google-document-ai": new GoogleDocumentAIAdapter(),
  "vision-ocr": new VisionOCRAdapter(),
  llm: new LLMExtractionAdapter(),
  gemini: new GeminiExtractionAdapter(),
};

export function getExtractionAdapter(): DocumentExtractionAdapter {
  const providerId = process.env.EXTRACTION_PROVIDER ?? (process.env.GEMINI_API_KEY ? "gemini" : "mock");
  return adapters[providerId] ?? adapters.mock;
}

export function isExtractionSimulated(): boolean {
  return getExtractionAdapter().isSimulated;
}
