import { MockExtractionAdapter } from "./mock-adapter";
import type { DocumentExtractionAdapter, ExtractedFieldValue, ExtractionInput } from "./types";

/**
 * Placeholders para provedores reais de OCR/IA documental. Nenhum deles é
 * implementado de fato no MVP — cada um cai de volta para o mock e sinaliza
 * `isSimulated: true`. Para plugar o provedor real:
 *   1. Instale o SDK oficial do provedor.
 *   2. Implemente `extract()` chamando a API com a chave de `process.env`.
 *   3. Troque `isSimulated` para `false` quando a chave estiver configurada.
 */
abstract class PlaceholderAdapter implements DocumentExtractionAdapter {
  abstract readonly id: string;
  abstract readonly label: string;
  readonly isSimulated = true;
  private readonly fallback = new MockExtractionAdapter();

  protected abstract envKeyName: string;

  async extract(input: ExtractionInput): Promise<ExtractedFieldValue[]> {
    // TODO(fase 2): chamar a API real do provedor quando `process.env[envKeyName]` estiver definido.
    return this.fallback.extract(input);
  }
}

export class GoogleDocumentAIAdapter extends PlaceholderAdapter {
  readonly id = "google-document-ai";
  readonly label = "Google Document AI (placeholder)";
  protected envKeyName = "GOOGLE_DOCUMENT_AI_API_KEY";
}

export class VisionOCRAdapter extends PlaceholderAdapter {
  readonly id = "vision-ocr";
  readonly label = "Google Vision OCR (placeholder)";
  protected envKeyName = "GOOGLE_VISION_API_KEY";
}

export class LLMExtractionAdapter extends PlaceholderAdapter {
  readonly id = "llm";
  readonly label = "Extração via LLM — Gemini/OpenAI/Anthropic (placeholder)";
  protected envKeyName = "LLM_PROVIDER";
}
