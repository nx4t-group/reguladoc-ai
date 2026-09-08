import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { DOCUMENT_TYPE_LABELS, type DocumentType } from "@/lib/constants";
import { FIELD_LABELS } from "@/lib/extraction/fields";
import type { DocumentData, ExtractedFieldData } from "./types";

export function FieldsTab({ documents, extractedFields }: { documents: DocumentData[]; extractedFields: ExtractedFieldData[] }) {
  if (extractedFields.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Nenhum campo extraído ainda. Envie documentos e clique em &quot;Extrair campos&quot; na aba Documentos.
        </CardContent>
      </Card>
    );
  }

  const avgConfidence = Math.round((extractedFields.reduce((s, f) => s + f.confidence, 0) / extractedFields.length) * 100);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Confiança média de extração</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center gap-3">
          <Progress value={avgConfidence} className="h-2 max-w-sm" />
          <span className="text-sm font-medium">{avgConfidence}%</span>
        </CardContent>
      </Card>

      <Accordion type="multiple" defaultValue={documents.map((d) => d.id)} className="space-y-2">
        {documents.map((doc) => {
          const fields = extractedFields.filter((f) => f.documentId === doc.id);
          if (fields.length === 0) return null;
          return (
            <AccordionItem key={doc.id} value={doc.id} className="rounded-lg border border-border bg-card px-4">
              <AccordionTrigger className="text-sm">
                {DOCUMENT_TYPE_LABELS[doc.documentType as DocumentType] ?? doc.documentType}
                <span className="ml-2 text-xs font-normal text-muted-foreground">({doc.filename})</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.id} className="flex items-center justify-between gap-3 border-b border-border/60 py-1.5 text-sm">
                      <span className="text-muted-foreground">{FIELD_LABELS[f.fieldKey] ?? f.fieldKey}</span>
                      <span className="text-right font-medium">
                        {f.fieldValue}
                        <span className="ml-1.5 text-[10px] text-muted-foreground">{Math.round(f.confidence * 100)}%</span>
                      </span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
}
