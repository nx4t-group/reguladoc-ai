"use server";

import { extractPdfText } from "@/lib/extraction/pdf-text";
import {
  parseDossierFieldsFromPdfText,
  type ExtractedDossierFormFields,
} from "@/lib/extraction/text-field-parser";

export interface ExtractionResult {
  ok: boolean;
  fields?: ExtractedDossierFormFields;
  identifiedDocuments?: string[];
  error?: string;
}

export async function extractInitialDossierData(formData: FormData): Promise<ExtractionResult> {
  try {
    const files = formData.getAll("files");
    if (!files || files.length === 0) {
      return { ok: false, error: "Nenhum arquivo enviado para extração." };
    }

    const allPages: string[] = [];
    const identifiedDocuments: string[] = [];

    for (const fileItem of files) {
      if (!(fileItem instanceof File)) continue;

      identifiedDocuments.push(fileItem.name);
      const buffer = Buffer.from(await fileItem.arrayBuffer());

      // Se for PDF, extrai páginas de texto
      if (fileItem.name.toLowerCase().endsWith(".pdf") || fileItem.type === "application/pdf") {
        try {
          const pages = extractPdfText(buffer);
          allPages.push(...pages);
        } catch (err) {
          console.error(`Erro ao extrair texto do PDF [${fileItem.name}]:`, err);
        }
      }
    }

    // Se extraiu texto de páginas reais do documento
    let extractedFields: ExtractedDossierFormFields = {};
    if (allPages.length > 0) {
      extractedFields = parseDossierFieldsFromPdfText(allPages);
    }

    // Tenta complementar com Gemini caso a chave esteja ativa e algum campo principal falte
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && (!extractedFields.importerName || !extractedFields.brand || !extractedFields.batchNumber)) {
      try {
        const firstFile = files.find((f) => f instanceof File && f.name.toLowerCase().endsWith(".pdf")) as File | undefined;
        if (firstFile) {
          const buffer = Buffer.from(await firstFile.arrayBuffer());
          const base64Data = buffer.toString("base64");

          const prompt = `Extraia os dados cadastrais do processo de importação de vinhos deste documento PDF.
Retorne um JSON com:
- importerName
- exporterName
- producerName
- countryOrigin
- productName
- brand
- vintage
- geographicalIndication
- batchNumber
- packageType
- packageCount
- unitsPerPackage
- unitCapacityLiters
- informedVolumeLiters
- internalNumber`;

          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [
                  {
                    parts: [
                      { text: prompt },
                      { inlineData: { mimeType: "application/pdf", data: base64Data } },
                    ],
                  },
                ],
                generationConfig: { responseMimeType: "application/json" },
              }),
            }
          );

          if (response.ok) {
            const data = await response.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) {
              const geminiFields = JSON.parse(text);
              extractedFields = {
                ...geminiFields,
                ...Object.fromEntries(
                  Object.entries(extractedFields).filter(([, v]) => Boolean(v))
                ),
              };
            }
          }
        }
      } catch (geminiErr) {
        console.warn("Falha no enriquecimento via Gemini (mantendo extração direta):", geminiErr);
      }
    }

    return {
      ok: true,
      fields: extractedFields,
      identifiedDocuments,
    };
  } catch (error) {
    console.error("Erro na extração de dados do dossiê:", error);
    return {
      ok: false,
      error: "Ocorreu um erro ao processar e extrair os dados dos documentos.",
    };
  }
}
