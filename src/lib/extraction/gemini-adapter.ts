import type { DocumentType } from "@/lib/constants";
import { readStoredFile } from "@/lib/storage";
import type { DocumentExtractionAdapter, ExtractedFieldValue, ExtractionInput } from "./types";
import { MockExtractionAdapter } from "./mock-adapter";

export class GeminiExtractionAdapter implements DocumentExtractionAdapter {
  readonly id = "gemini";
  readonly label = "Google Gemini (OCR Real)";

  get isSimulated(): boolean {
    return !process.env.GEMINI_API_KEY;
  }

  private readonly fallback = new MockExtractionAdapter();

  async extract(input: ExtractionInput): Promise<ExtractedFieldValue[]> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      // Sem chave de API, caímos de volta no mock
      return this.fallback.extract(input);
    }

    if (!input.filePath) {
      return this.fallback.extract(input);
    }

    try {
      const fileBuffer = await readStoredFile(input.filePath);
      const base64Data = fileBuffer.toString("base64");

      // Resolve o mimeType apropriado
      let mimeType = "application/pdf";
      if (input.filename.endsWith(".png")) {
        mimeType = "image/png";
      } else if (input.filename.endsWith(".jpg") || input.filename.endsWith(".jpeg")) {
        mimeType = "image/jpeg";
      }

      const fieldsToExtract = documentFieldsPrompt[input.documentType] || ["observacoes"];

      const prompt = `Você é um analista especialista em importação de vinhos pelo Ministério da Agricultura do Brasil (MAPA).
Analise o documento anexado (que é do tipo "${input.documentType}") e extraia os valores para os seguintes campos:
${fieldsToExtract.map(f => `- ${f}`).join("\n")}

Contexto do dossiê para referência e auxílio de busca:
- Marca esperada: ${input.dossierContext.brand}
- Nome do produto esperado: ${input.dossierContext.productName}
- Importador esperado: ${input.dossierContext.importerName}
- Exportador esperado: ${input.dossierContext.exporterName || "Não informado"}
- Lote esperado: ${input.dossierContext.batchNumber || "Não informado"}

Instruções críticas:
1. Extraia APENAS o que estiver explicitamente escrito no documento. Se um campo não puder ser extraído ou não constar no documento, não inclua-o ou deixe o valor vazio.
2. Certifique-se de extrair o número do lote ("numero_lote") e do laudo ("numero_laudo") se estiverem presentes no documento.
3. Para dados laboratoriais no laudo de análise (teor alcoólico, acidez, ph, etc.), extraia o valor com a unidade descrita (ex: "13,5% vol", "3.42", "0,52 g/L").
4. Se houver alguma observação no laudo sobre ensaios realizados "fora do escopo de acreditação" ou se a amostragem "não foi realizada pelo laboratório", coloque essa informação no campo "observacao_acreditacao".
5. Retorne a resposta estruturada em JSON contendo uma lista "fields" com objetos {key, value, confidence}. A confiança deve ser um valor entre 0.0 e 1.0.`;

      const response = await fetch(
        // Alias mantido pelo Google apontando para o modelo flash recomendado
        // atual — evita quebrar de novo quando uma versão específica (ex.
        // gemini-1.5-flash) for descontinuada.
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: prompt },
                  {
                    inlineData: {
                      mimeType,
                      data: base64Data,
                    },
                  },
                ],
              },
            ],
            generationConfig: {
              responseMimeType: "application/json",
              responseSchema: {
                type: "OBJECT",
                properties: {
                  fields: {
                    type: "ARRAY",
                    items: {
                      type: "OBJECT",
                      properties: {
                        key: { type: "STRING" },
                        value: { type: "STRING" },
                        confidence: { type: "NUMBER" },
                      },
                      required: ["key", "value"],
                    },
                  },
                },
                required: ["fields"],
              },
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Erro na API do Gemini:", errorText);
        return this.fallback.extract(input);
      }

      const resJson = await response.json();
      const textResponse = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!textResponse) {
        return this.fallback.extract(input);
      }

      const parsed = JSON.parse(textResponse);
      if (parsed && Array.isArray(parsed.fields)) {
        return parsed.fields.map((f: { key: string; value: string; confidence?: number }) => ({
          key: f.key,
          value: f.value || "",
          confidence: typeof f.confidence === "number" ? f.confidence : 0.9,
        }));
      }

      return this.fallback.extract(input);
    } catch (err) {
      console.error("Falha ao extrair com Gemini, usando mock fallback:", err);
      return this.fallback.extract(input);
    }
  }
}

const documentFieldsPrompt: Record<DocumentType, string[]> = {
  anexo_ix: ["marca", "denominacao", "importador", "exportador", "produtor", "numero_lote", "numero_laudo", "indicacao_geografica", "safra", "numero_embalagens", "unidades_por_embalagem", "capacidade_unitaria", "volume_total_informado", "referencia_normativa"],
  certificado_origem: ["numero_certificado", "orgao_emissor", "data_emissao", "pais_origem", "produtor", "marca", "denominacao", "indicacao_geografica", "numero_lote"],
  laudo_analise: ["numero_laudo", "laboratorio", "data_laudo", "finalidade", "numero_lote", "marca", "produtor", "teor_alcoolico", "acidez_total", "acidez_volatil", "acucares_totais", "metanol", "ph", "sulfatos", "observacao_acreditacao"],
  cii: ["numero_certificado", "orgao_emissor", "data_emissao", "apto_inapto", "marca", "produtor", "numero_lote"],
  invoice: ["importador", "exportador", "marca", "denominacao", "numero_lote", "tipo_embalagem", "numero_embalagens", "unidades_por_embalagem", "capacidade_unitaria", "volume_total_informado"],
  packing_list: ["tipo_embalagem", "numero_embalagens", "unidades_por_embalagem", "capacidade_unitaria", "volume_total_informado", "numero_lote", "marca"],
  rotulo: ["marca", "denominacao", "cor", "teor_acucar", "safra", "uva", "indicacao_geografica", "denominacao_origem", "importador", "pais_origem"],
  complementar: ["observacoes"],
  outro: ["observacoes"]
};
