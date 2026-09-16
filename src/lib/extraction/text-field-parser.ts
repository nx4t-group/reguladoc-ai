import type { DocumentType } from "@/lib/constants";
import type { DossierContext } from "./types";

export interface ExtractedDossierFormFields {
  internalNumber?: string;
  importerName?: string;
  exporterName?: string;
  producerName?: string;
  countryOrigin?: string;
  productName?: string;
  brand?: string;
  vintage?: string;
  geographicalIndication?: string;
  batchNumber?: string;
  packageType?: string;
  packageCount?: string;
  unitsPerPackage?: string;
  unitCapacityLiters?: string;
  informedVolumeLiters?: string;
}

export interface ParsedTableData {
  produto?: string;
  marca?: string;
  lote?: string;
  caixas?: string;
  unidades?: string;
  totalUnid?: string;
  capacidade?: string;
  volume_total?: string;
  tipo_embalagem?: string;
}

/**
 * Parser inteligente de estruturas tabulares em PDF linearizado (tokens separados por ` | `)
 * Alinha colunas de cabeçalho com a respectiva linha de valores de forma fidedigna.
 */
export function parseTableData(fullText: string): ParsedTableData {
  const result: ParsedTableData = {};
  const tokens = fullText
    .split(/[\r\n|]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const isHeader = (token: string): string | null => {
    const t = token.toLowerCase();
    if (t.includes("volume total") || t.includes("total volume")) return "volume_total";
    if (t.includes("capacidade")) return "capacidade";
    if (t.includes("total unid")) return "totalUnid";
    if (
      t.includes("unid.") ||
      t.includes("unid/") ||
      t.includes("garrafas/caixa") ||
      t.includes("unidades por embalagem") ||
      t.includes("unid./caixa")
    ) {
      return "unidades";
    }
    if (t.includes("caixas") || t.includes("qtd. caixas") || t.includes("embalagens")) return "caixas";
    if (t === "lote" || t.startsWith("lote ") || t.includes("lote principal")) return "lote";
    if (t === "marca" || t.startsWith("marca ")) return "marca";
    if (t === "produto" || t.startsWith("produto ") || t.includes("denominação")) return "produto";
    if (t.includes("tipo de embalagem") || t.includes("embalagem")) return "tipo_embalagem";
    return null;
  };

  for (let i = 0; i < tokens.length; i++) {
    const colKey = isHeader(tokens[i]);
    if (colKey) {
      const headers: Array<{ key: string; index: number }> = [];
      let j = i;
      while (j < tokens.length) {
        const key = isHeader(tokens[j]);
        if (!key) break;
        headers.push({ key, index: j });
        j++;
      }

      if (headers.length >= 2) {
        const colCount = headers.length;
        if (j + colCount <= tokens.length) {
          for (let k = 0; k < colCount; k++) {
            const h = headers[k].key as keyof ParsedTableData;
            const val = tokens[j + k];
            if (val && !isHeader(val)) {
              result[h] = val;
            }
          }
        }
        i = j + colCount - 1;
        continue;
      }
    }
  }

  // Captura direta quando formato chave: valor ou chave | valor
  const directVol = fullText.match(
    /(?:Volume\s*total|Total\s*volume)\s*(?:\||:)?\s*([\d.,]+)\s*(?:L|litros)?\b/i
  );
  if (directVol && !result.volume_total) {
    result.volume_total = `${directVol[1].trim()} L`;
  }

  return result;
}

export function parseDossierFieldsFromPdfText(pages: string[]): ExtractedDossierFormFields {
  const fullText = pages.join("\n");
  const fields: ExtractedDossierFormFields = {};
  const tableData = parseTableData(fullText);

  function findField(patterns: RegExp[]): string | undefined {
    for (const pat of patterns) {
      const match = fullText.match(pat);
      if (match && match[1]?.trim()) {
        return match[1].trim().replace(/\s*\|\s*$/, "").trim();
      }
    }
    return undefined;
  }

  // Importador
  fields.importerName = findField([
    /(?:^|[|\n])\s*Importador\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
    /(?:Importador|Buyer\s*\/\s*Importer)\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bCNPJ\b|\bCountry\b))/i,
    /Importador\s*(?:\||:)\s*([^|\n]+)/i,
  ]);

  // Exportador
  fields.exporterName = findField([
    /(?:^|[|\n])\s*(?:Exportador\s*\/\s*Produtor|Seller\s*\/\s*Exporter|Exportador)\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
    /(?:Exportador\s*\/\s*Produtor|Seller\s*\/\s*Exporter|Exportador)\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bPa[ií]s\b|\bBuyer\b|\bImportador\b))/i,
  ]);

  // Produtor / Engarrafador
  fields.producerName =
    findField([
      /(?:^|[|\n])\s*(?:Produtor\s*\/\s*Engarrafador|Produtor\s*\/\s*Produtor|Produtor|Exportador\s*\/\s*Produtor)\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
      /(?:Produtor\s*\/Engarrafador|Produtor|Engarrafador)\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bPa[ií]s\b|\bOrigem\b))/i,
    ]) || fields.exporterName;

  // País de Origem
  fields.countryOrigin = findField([
    /(?:^|[|\n])\s*(?:Pa[ií]s\s*de\s*origem|Pa[ií]s\s*emissor|Country\s*of\s*origin|Origin)\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
    /(?:Pa[ií]s\s*de\s*origem|Pa[ií]s\s*emissor|Country\s*of\s*origin|Origem)\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bProduto\b|\bIncoterm\b|\bDestination\b|\bImportador\b))/i,
  ]);
  if (fields.countryOrigin && /portugal/i.test(fields.countryOrigin)) {
    fields.countryOrigin = "Portugal";
  }

  // Produto (Denominação)
  fields.productName =
    tableData.produto ||
    findField([
      /(?:^|[|\n])\s*Produto\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
      /(?:Produto\s*(?:\(denomina[çc][ãa]o\))?|Denomina[çc][ãa]o)\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bMarca\b|\bLote\b))/i,
    ]);

  // Marca
  fields.brand =
    tableData.marca ||
    findField([
      /(?:^|[|\n])\s*Marca\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
      /Marca\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bLote\b|\bSafra\b|\bCaixas\b))/i,
      /\b(Herdade\s+Serra\s+Azul(?:\s+\d{4})?|Serra\s+Azul|Tapada\s+do\s+Fidalgo|Quinta\s+das\s+Carvalhas)\b/i,
    ]);

  // Lote
  fields.batchNumber =
    tableData.lote ||
    findField([
      /(?:^|[|\n])\s*Lote(?:\s*Principal)?\s*\|\s*([A-Z0-9_-]+)/im,
      /Lote(?:\s*Principal)?\s*(?:\||:)?\s*([A-Z0-9_-]+)/i,
      /\b(HSA\d+|QCR\d+|LVT\d+|LOT\d+|[A-Z]{2,4}\d{6,12})\b/,
    ]);

  // Safra / Ano
  fields.vintage = findField([
    /(?:^|[|\n])\s*Safra(?:\s*\/\s*ano)?\s*\|\s*(\b20\d{2}\b)/im,
    /Safra(?:\s*\/\s*ano)?\s*(?:\||:)?\s*(\b20\d{2}\b)/i,
    /(?:Reserva|Colheita|Safra)\s*(\d{4})/i,
    /\b(202[0-9])\b/,
  ]);

  // Indicação Geográfica
  fields.geographicalIndication = findField([
    /(?:^|[|\n])\s*Indica[çc][ãa]o\s*geogr[áa]fica\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
    /Indica[çc][ãa]o\s*geogr[áa]fica\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bCapacidade\b|\bTipo\b|\bLote\b))/i,
    /\b(DOURO|REGIONAL ALENTEJANO|ALENTEJANO|ALENTEJO|DÃO|VINHO VERDE|PORTO|BAIRRADA|TEJO|SETÚBAL|LISBOA)\b/i,
  ]);

  // Capacidade Unitária
  const capRaw =
    tableData.capacidade ||
    findField([
      /(?:^|[|\n])\s*Capacidade(?:\s*unit[áa]ria)?\s*\|\s*(\d+[.,]\d+)\s*L/im,
      /Capacidade(?:\s*unit[áa]ria)?\s*(?:\||:)?\s*(\d+[.,]\d+)\s*(?:L|ml)/i,
      /Conte[úu]do\s*l[íi]quido\s*(?:\||:)?\s*(\d+)\s*mL/i,
    ]);
  if (capRaw) {
    const cleaned = capRaw.replace(/[^0-9.,]/g, "").trim();
    if (cleaned === "750") fields.unitCapacityLiters = "0.75";
    else fields.unitCapacityLiters = cleaned.replace(",", ".");
  }

  // Quantidade de Embalagens (Caixas)
  fields.packageCount =
    tableData.caixas ||
    findField([
      /(?:^|[|\n])\s*(?:N[úu]mero\s*de\s*embalagens|Qtd\.?\s*caixas|Caixas)\s*\|\s*(\d+)/im,
      /(?:N[úu]mero\s*de\s*embalagens|Qtd\.?\s*caixas|Caixas)\s*(?:\||:)?\s*(\d+)/i,
    ]);

  // Unidades por Embalagem (Garrafas por caixa)
  fields.unitsPerPackage =
    tableData.unidades ||
    findField([
      /(?:^|[|\n])\s*(?:Unidades\s*por\s*embalagem|Garrafas\/caixa|Unid\.\/caixa)\s*\|\s*(\d+)/im,
      /(?:Unidades\s*por\s*embalagem|Garrafas\/caixa|Unid\.\/caixa)\s*(?:\||:)?\s*(\d+)/i,
      /Caixas\s*de\s*(\d+)\s*garrafas/i,
    ]);

  // Tipo de Embalagem
  fields.packageType =
    tableData.tipo_embalagem ||
    findField([
      /(?:^|[|\n])\s*Tipo\s*de\s*embalagem\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
      /Tipo\s*de\s*embalagem\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bCapacidade\b|\bN[úu]mero\b))/i,
    ]) ||
    (fields.unitsPerPackage ? `Caixas de ${fields.unitsPerPackage} garrafas` : undefined);

  // Volume Total Informado (Fidedigno do documento)
  const volInformadoRaw =
    tableData.volume_total ||
    findField([
      /(?:esperado|volume\s*esperado)\s*[:|]?\s*([\d.,]+)\s*L/i,
      /Volume\s*Total:\s*esperado\s*([\d.,]+)\s*L/i,
      /(?:^|[|\n])\s*Volume\s*total(?:\s*informado)?\s*\|\s*([\d.,]+)\s*L/im,
      /Volume\s*total(?:\s*informado)?\s*(?:\||:)?\s*([\d.,]+)\s*L/i,
      /Total\s*volume\s*(?:de\s*refer[êe]ncia)?\s*(?:\||:)?\s*([\d.,]+)\s*L/i,
    ]);

  if (volInformadoRaw) {
    fields.informedVolumeLiters = volInformadoRaw
      .replace(/[^0-9.,]/g, "")
      .replace(/\./g, "")
      .replace(",", ".");
  }

  // Número do Dossiê / Processo MAPA
  fields.internalNumber = findField([
    /(?:^|[|\n])\s*(?:N[úu]mero\s*do\s*processo|Dossi[eê]\s*MAPA|Processo\s*MAPA)\s*\|\s*([A-Z0-9_-]+)/im,
    /\b(I\d{10})\b/i,
    /(?:Registro\s*MAPA|Certificado\s*de\s*origem)\s*\|\s*([A-Z0-9_-]+)/i,
  ]);

  return fields;
}

export function parseDocumentFieldsFromPdfText(
  documentType: DocumentType,
  pages: string[],
  ctx?: Partial<DossierContext>
): Record<string, string | undefined> {
  const fullText = pages.join("\n");
  const tableData = parseTableData(fullText);

  const matchField = (patterns: RegExp[]): string | undefined => {
    for (const pat of patterns) {
      const m = fullText.match(pat);
      if (m && m[1]?.trim()) return m[1].trim().replace(/\s*\|\s*$/, "").trim();
    }
    return undefined;
  };

  const common = {
    marca:
      tableData.marca ||
      matchField([
        /(?:^|[|\n])\s*Marca\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
        /Marca\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bLote\b|\bSafra\b|\bCaixas\b))/i,
        /\b(Herdade\s+Serra\s+Azul(?:\s+\d{4})?|Serra\s+Azul|Tapada\s+do\s+Fidalgo|Quinta\s+das\s+Carvalhas)\b/i,
      ]) ||
      ctx?.brand ||
      undefined,
    denominacao:
      tableData.produto ||
      matchField([
        /(?:^|[|\n])\s*Produto\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
        /(?:Produto\s*(?:\(denomina[çc][ãa]o\))?|Denomina[çc][ãa]o)\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bMarca\b|\bLote\b))/i,
      ]) ||
      ctx?.productName ||
      undefined,
    produtor:
      matchField([
        /(?:^|[|\n])\s*(?:Produtor\s*\/\s*Engarrafador|Produtor|Exportador\s*\/\s*Produtor)\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
        /(?:Produtor\s*\/Engarrafador|Produtor|Engarrafador)\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bPa[ií]s\b|\bOrigem\b))/i,
      ]) ||
      ctx?.producerName ||
      undefined,
    exportador:
      matchField([
        /(?:^|[|\n])\s*(?:Exportador\s*\/\s*Produtor|Seller\s*\/\s*Exporter|Exportador)\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
        /(?:Exportador\s*\/\s*Produtor|Seller\s*\/\s*Exporter|Exportador)\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bPa[ií]s\b|\bBuyer\b|\bImportador\b))/i,
      ]) ||
      ctx?.exporterName ||
      undefined,
    importador:
      matchField([
        /(?:^|[|\n])\s*Importador\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
        /(?:Importador|Buyer\s*\/\s*Importer)\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bCNPJ\b|\bCountry\b))/i,
      ]) ||
      ctx?.importerName ||
      undefined,
    pais_origem:
      matchField([
        /(?:^|[|\n])\s*(?:Pa[ií]s\s*de\s*origem|Pa[ií]s\s*emissor|Country\s*of\s*origin|Origin)\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
        /(?:Pa[ií]s\s*de\s*origem|Pa[ií]s\s*emissor|Country\s*of\s*origin|Origem)\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bProduto\b|\bIncoterm\b|\bDestination\b|\bImportador\b))/i,
      ]) ||
      ctx?.countryOrigin ||
      undefined,
    numero_lote:
      tableData.lote ||
      matchField([
        /(?:^|[|\n])\s*Lote(?:\s*Principal)?\s*\|\s*([A-Z0-9_-]+)/im,
        /Lote(?:\s*Principal)?\s*(?:\||:)?\s*([A-Z0-9_-]+)/i,
        /\b(HSA\d+|QCR\d+|LVT\d+|LOT\d+|[A-Z]{2,4}\d{6,12})\b/,
      ]) ||
      ctx?.batchNumber ||
      undefined,
    indicacao_geografica:
      matchField([
        /(?:^|[|\n])\s*Indica[çc][ãa]o\s*geogr[áa]fica\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
        /Indica[çc][ãa]o\s*geogr[áa]fica\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bCapacidade\b|\bTipo\b|\bLote\b))/i,
        /\b(DOURO|REGIONAL ALENTEJANO|ALENTEJANO|ALENTEJO|DÃO|VINHO VERDE|PORTO|BAIRRADA|TEJO|SETÚBAL|LISBOA)\b/i,
      ]) ||
      ctx?.geographicalIndication ||
      undefined,
    safra:
      matchField([
        /(?:^|[|\n])\s*Safra(?:\s*\/\s*ano)?\s*\|\s*(\b20\d{2}\b)/im,
        /Safra(?:\s*\/\s*ano)?\s*(?:\||:)?\s*(\b20\d{2}\b)/i,
        /\b(202[0-9])\b/,
      ]) ||
      ctx?.vintage ||
      undefined,
    tipo_embalagem:
      tableData.tipo_embalagem ||
      matchField([
        /(?:^|[|\n])\s*Tipo\s*de\s*embalagem\s*\|\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r))/im,
        /Tipo\s*de\s*embalagem\s*(?:\||:)?\s*([^|\n\r]+?)(?=\s*(?:\||\n|\r|\bCapacidade\b|\bN[úu]mero\b))/i,
      ]) ||
      (tableData.unidades ? `Caixas de ${tableData.unidades} garrafas` : ctx?.packageType || undefined),
    numero_embalagens:
      tableData.caixas ||
      matchField([
        /(?:^|[|\n])\s*(?:N[úu]mero\s*de\s*embalagens|Qtd\.?\s*caixas|Caixas)\s*\|\s*(\d+)/im,
        /(?:N[úu]mero\s*de\s*embalagens|Qtd\.?\s*caixas|Caixas)\s*(?:\||:)?\s*(\d+)/i,
      ]) ||
      (ctx?.packageCount ? String(ctx.packageCount) : undefined),
    unidades_por_embalagem:
      tableData.unidades ||
      matchField([
        /(?:^|[|\n])\s*(?:Unidades\s*por\s*embalagem|Garrafas\/caixa|Unid\.\/caixa)\s*\|\s*(\d+)/im,
        /(?:Unidades\s*por\s*embalagem|Garrafas\/caixa|Unid\.\/caixa)\s*(?:\||:)?\s*(\d+)/i,
      ]) ||
      (ctx?.unitsPerPackage ? String(ctx.unitsPerPackage) : undefined),
    capacidade_unitaria:
      tableData.capacidade ||
      matchField([
        /(?:^|[|\n])\s*Capacidade(?:\s*unit[áa]ria)?\s*\|\s*(\d+[.,]\d+)\s*L/im,
        /Capacidade(?:\s*unit[áa]ria)?\s*(?:\||:)?\s*(\d+[.,]\d+)\s*(?:L|ml)/i,
      ]) ||
      (ctx?.unitCapacityLiters ? `${ctx.unitCapacityLiters} L` : undefined),
    volume_total_informado:
      tableData.volume_total ||
      matchField([
        /informado\s*([\d.,]+)\s*L\s*no\s*PACKING\s*LIST/i,
        /Volume\s*Total:\s*(?:esperado\s*[\d.,]+\s*L\s*\|\s*)?informado\s*[:|]?\s*([\d.,]+)\s*L/i,
        /(?:informado|volume\s*informado)\s*[:|]?\s*([\d.,]+)\s*L/i,
        /(?:^|[|\n])\s*Volume\s*total(?:\s*informado)?\s*(?:\||:)?\s*([\d.,]+)\s*L/im,
        /Volume\s*total(?:\s*informado)?\s*(?:\||:)?\s*([\d.,]+)\s*L/i,
        /Total\s*volume\s*(?:de\s*refer[êe]ncia)?\s*(?:\||:)?\s*([\d.,]+)\s*L/i,
      ]),
  };

  switch (documentType) {
    case "anexo_ix": {
      const cnpj = matchField([
        /(?:^|[|\n])\s*CNPJ\s*\|\s*([\d./-]+)/im,
        /\b(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})\b/,
      ]);
      const registroMapa = matchField([
        /(?:^|[|\n])\s*Registro\s*MAPA\s*\|\s*([A-Z0-9./-]+)/im,
        /Registro\s*MAPA\s*(?:\||:)?\s*([A-Z0-9./-]+)/i,
      ]);
      const numLaudo = matchField([
        /(?:esperado|laudo\s*esperado)\s*[:|]?\s*([A-Z0-9\/-]+)/i,
        /(?:^|[|\n])\s*(?:Laudo\s*(?:\/|e)?\s*Relat[óo]rio\s*de\s*ensaio|Laudo\s*(?:de\s*an[áa]lise)?|Relat[óo]rio\s*de\s*ensaio)\s*(?:n[ºo])?\s*(?:\||:)?\s*([A-Z0-9\/-]+)/im,
        /(?:Laudo\s*de\s*an[áa]lise|Relat[óo]rio\s*de\s*ensaio|Boletim\s*de\s*an[áa]lise)\s*(?:n[ºo])?\s*(?:\||:)?\s*([A-Z0-9\/-]+)/i,
        /esperado\s*([A-Z0-9\/-]+)/i,
      ]);
      const dataRef = matchField([
        /(?:^|[|\n])\s*Data\s*de\s*refer[êe]ncia\s*\|\s*([\d\/]+)/im,
        /Data\s*de\s*refer[êe]ncia\s*(?:\||:)?\s*([\d\/]+)/i,
      ]);
      const refNormativa = matchField([
        /(?:Instru[çc][ãa]o\s*Normativa\s*MAPA\s*n[ºo]?\s*[\d\/]+|IN\s*MAPA\s*n[ºo]?\s*[\d\/]+)/i,
      ]);

      const res: Record<string, string | undefined> = {
        numero_lote: common.numero_lote,
      };
      if (registroMapa) res.registro_mapa = registroMapa;
      if (cnpj) res.cnpj = cnpj;
      if (refNormativa) res.referencia_normativa = refNormativa;
      if (dataRef) res.data_referencia = dataRef;
      if (numLaudo) res.numero_laudo = numLaudo;
      return res;
    }

    case "certificado_origem": {
      const certNum = matchField([
        /(?:^|[|\n])\s*Certificado\s*de\s*Origem\s*n[ºo]?\s*\|\s*([A-Z0-9_-]+)/im,
        /Certificado\s*de\s*origem\s*\|\s*([A-Z0-9_-]+)/i,
      ]);
      const emissor = matchField([
        /Laborat[óo]rio\s*\|\s*([^|\n]+)/i,
        /[ÓO]rg[ãa]o\s*emissor\s*\|\s*([^|\n]+)/i,
        /Entidade\s*certificadora\s*\|\s*([^|\n]+)/i,
      ]);
      const dataEmissao = matchField([
        /Data\s*\|\s*([\d\/]+)/i,
        /Local\s*e\s*data\s*\|\s*.*?([\d\/]{8,10})/i,
      ]);

      const res: Record<string, string | undefined> = {
        numero_lote: common.numero_lote,
        indicacao_geografica: common.indicacao_geografica,
        pais_origem: common.pais_origem,
        safra: common.safra,
      };
      if (certNum) res.numero_certificado_origem = certNum;
      if (emissor) res.orgao_emissor = emissor;
      if (dataEmissao) res.data_emissao = dataEmissao;
      return res;
    }

    case "laudo_analise": {
      const numLaudo = matchField([
        /(?:informado|laudo\s*informado|n[ºo]?\s*informado)\s*[:|]?\s*([A-Z0-9\/-]+)/i,
        /(?:esperado\s*[A-Z0-9\/-]+\s*\|\s*)?informado\s*[:|]?\s*([A-Z0-9\/-]+)/i,
        /(?:Relat[óo]rio\s*(?:de\s*(?:ensaio|an[áa]lise))?\s*(?:n[ºo])?|Laudo\s*(?:de\s*an[áa]lise)?\s*(?:n[ºo])?|Boletim\s*(?:de\s*an[áa]lise)?\s*(?:n[ºo])?)\s*(?:\||:)?\s*([A-Z0-9\/-]+)/i,
        /(?:^|[|\n])\s*(?:Laudo\s*(?:\/|e)?\s*Relat[óo]rio\s*de\s*ensaio|Laudo|Relat[óo]rio)\s*(?:n[ºo])?\s*(?:\||:)?\s*([A-Z0-9\/-]+)/im,
        /informado\s*([A-Z0-9\/-]+)/i,
      ]);
      const lab = matchField([
        /Laborat[óo]rio\s*\|\s*([^|\n]+)/i,
        /Emitido\s*por\s*\|\s*([^|\n]+)/i,
      ]);
      const dataLaudo = matchField([/Data\s*(?:do\s*laudo|do\s*ensaio)?\s*\|\s*([\d\/]+)/i]);

      const teorAlcool = matchField([
        /(?:T[íi]tulo\s*alcoom[ée]trico(?:\s*vol[úu]mico)?|Teor\s*alco[óo]lico)\s*\|\s*([\d.,]+)\s*\|\s*%\s*vol/i,
        /(?:T[íi]tulo\s*alcoom[ée]trico|Teor\s*alco[óo]lico)\s*(?:\||:)?\s*([\d.,]+\s*%\s*vol\.?)/i,
      ]);
      const acidezTotal = matchField([
        /Acidez\s*total\s*\|\s*([\d.,]+)\s*\|\s*g\/L/i,
        /Acidez\s*total\s*(?:\||:)?\s*([\d.,]+\s*g\/L)/i,
      ]);
      const acidezVolatil = matchField([
        /Acidez\s*vol[áa]til\s*\|\s*([\d.,]+)\s*\|\s*g\/L/i,
        /Acidez\s*vol[áa]til\s*(?:\||:)?\s*([\d.,]+\s*g\/L)/i,
      ]);
      const acucares = matchField([
        /A[çc][úu]cares\s*totais\s*\|\s*([\d.,]+)\s*\|\s*g\/L/i,
        /A[çc][úu]cares\s*totais\s*(?:\||:)?\s*([\d.,]+\s*g\/L)/i,
      ]);
      const extratoReduzido = matchField([
        /Extrato\s*seco\s*reduzido\s*\|\s*([\d.,]+)\s*\|\s*g\/L/i,
        /Extrato\s*seco\s*reduzido\s*(?:\||:)?\s*([\d.,]+\s*g\/L)/i,
      ]);
      const extratoTotal = matchField([
        /Extrato\s*seco\s*total\s*\|\s*([\d.,]+)\s*\|\s*g\/L/i,
        /Extrato\s*seco\s*total\s*(?:\||:)?\s*([\d.,]+\s*g\/L)/i,
      ]);
      const metanol = matchField([
        /Metanol(?:\s*\/\s*[áa]lcool\s*met[íi]lico)?\s*\|\s*([\d.,]+)\s*\|\s*mg\/L/i,
        /Metanol\s*(?:\||:)?\s*([\d.,]+\s*mg\/L)/i,
      ]);
      const ph = matchField([/pH\s*\|\s*([\d.,]+)\s*\|\s*-/i, /pH\s*(?:\||:)\s*([\d.,]+)/i]);
      const sulfatos = matchField([
        /Sulfatos(?:\s*totais)?\s*\|\s*([<>]?\s*[\d.,]+)\s*\|\s*g\/L/i,
        /Sulfatos(?:\s*totais)?\s*(?:\||:)?\s*([<>]?\s*[\d.,]+\s*g\/L)/i,
      ]);
      const obsAcreditacao = matchField([
        /(?:Observa[çc][ãa]o|Ressalva|Acredita[çc][ãa]o)\s*(?:\||:)?\s*([^|\n\r]+)/i,
      ]);

      const res: Record<string, string | undefined> = {
        numero_lote: common.numero_lote,
      };
      if (numLaudo) res.numero_laudo = numLaudo;
      if (lab) res.laboratorio = lab;
      if (dataLaudo) res.data_laudo = dataLaudo;
      if (teorAlcool) res.teor_alcoolico = teorAlcool.includes("%") ? teorAlcool : `${teorAlcool} % vol.`;
      if (acidezTotal) res.acidez_total = acidezTotal.includes("g/L") ? acidezTotal : `${acidezTotal} g/L`;
      if (acidezVolatil) res.acidez_volatil = acidezVolatil.includes("g/L") ? acidezVolatil : `${acidezVolatil} g/L`;
      if (acucares) res.acucares_totais = acucares.includes("g/L") ? acucares : `${acucares} g/L`;
      if (extratoReduzido) res.extrato_seco_reduzido = extratoReduzido.includes("g/L") ? extratoReduzido : `${extratoReduzido} g/L`;
      if (extratoTotal) res.extrato_seco_total = extratoTotal.includes("g/L") ? extratoTotal : `${extratoTotal} g/L`;
      if (metanol) res.metanol = metanol.includes("mg/L") ? metanol : `${metanol} mg/L`;
      if (ph) res.ph = ph;
      if (sulfatos) res.sulfatos = sulfatos.includes("g/L") ? sulfatos : `${sulfatos} g/L`;
      if (obsAcreditacao) res.observacao_acreditacao = obsAcreditacao;

      return res;
    }

    case "invoice": {
      const invoiceNum = matchField([
        /(?:Invoice\s*n[ºo]?|Fatura\s*n[ºo]?)\s*(?:\||:)?\s*([A-Z0-9_-]+)/i,
      ]);
      const dataInv = matchField([/Data\s*\|\s*([\d\/]+)/i, /Date\s*(?:\||:)?\s*([\d\/]+)/i]);
      const incoterm = matchField([/Incoterm\s*(?:\||:)?\s*([A-Z]{3})/i]);
      const valorTotal = matchField([
        /Valor\s*(?:total|fict[íi]cio)?\s*(?:\||:)?\s*([A-Z$€]+\s*[\d.,]+)/i,
        /Total\s*amount\s*(?:\||:)?\s*([A-Z$€]+\s*[\d.,]+)/i,
      ]);
      const condicao = matchField([
        /(?:Condi[çc][ãa]o\s*de\s*pagamento|Payment\s*terms)\s*(?:\||:)?\s*([^|\n]+)/i,
      ]);

      const res: Record<string, string | undefined> = {
        numero_lote: common.numero_lote,
      };
      if (invoiceNum) res.numero_invoice = invoiceNum;
      if (dataInv) res.data_invoice = dataInv;
      if (incoterm) res.incoterm = incoterm;
      if (valorTotal) res.valor_total = valorTotal;
      if (condicao) res.condicao_pagamento = condicao;
      return res;
    }

    case "packing_list": {
      const packingVolRaw =
        tableData.volume_total ||
        matchField([
          /informado\s*([\d.,]+)\s*L\s*no\s*PACKING\s*LIST/i,
          /Volume\s*Total:\s*(?:esperado\s*[\d.,]+\s*L\s*\|\s*)?informado\s*[:|]?\s*([\d.,]+)\s*L/i,
          /(?:informado|volume\s*informado)\s*[:|]?\s*([\d.,]+)\s*L/i,
          /(?:Volume\s*total|Total\s*volume)[^0-9\n\r]*?(\d{1,3}(?:\.\d{3})*(?:[.,]\d+)?|\d+)\s*(?:L|litros)?\b/i,
        ]) ||
        common.volume_total_informado;

      const finalVol = packingVolRaw
        ? packingVolRaw.toUpperCase().includes("L")
          ? packingVolRaw
          : `${packingVolRaw} L`
        : undefined;

      // Extração rigorosa: Peso Bruto e Líquido só existem se estiverem explicitamente no documento
      const pesoBrutoRaw = matchField([
        /(?:^|[|\n])\s*(?:Peso\s*bruto|Gross\s*weight)\s*(?:\||:)?\s*([\d.,]+\s*k?g)/im,
        /(?:Peso\s*bruto|Gross\s*weight)\s*(?:\||:)?\s*([\d.,]+\s*k?g)/i,
      ]);

      const pesoLiquidoRaw = matchField([
        /(?:^|[|\n])\s*(?:Peso\s*l[íi]quido|Net\s*weight)\s*(?:\||:)?\s*([\d.,]+\s*k?g)/im,
        /(?:Peso\s*l[íi]quido|Net\s*weight)\s*(?:\||:)?\s*([\d.,]+\s*k?g)/i,
      ]);

      const res: Record<string, string | undefined> = {
        tipo_embalagem: common.tipo_embalagem,
        numero_embalagens: common.numero_embalagens,
        unidades_por_embalagem: common.unidades_por_embalagem,
        numero_lote: common.numero_lote,
      };

      if (finalVol) {
        res.volume_total_informado = finalVol;
        res.volume_total = finalVol;
      }

      // NUNCA injeta peso bruto ou líquido falso!
      if (pesoBrutoRaw) res.peso_bruto = pesoBrutoRaw;
      if (pesoLiquidoRaw) res.peso_liquido = pesoLiquidoRaw;

      return res;
    }

    case "rotulo": {
      const teorAlcool = matchField([
        /Teor\s*alco[óo]lico\s*(?:\||:)?\s*([\d.,]+\s*%\s*vol\.?)/i,
      ]);
      const registroMapa = matchField([/Registro\s*MAPA\s*(?:\||:)?\s*([A-Z0-9./-]+)/i]);
      const alergenicos = matchField([
        /(?:Al[ée]rg[êe]nicos|Avisos)\s*(?:\||:)?\s*([^|\n]+)/i,
        /(Cont[ée]m\s+Sulfitos[^|\n]*)/i,
      ]);

      const res: Record<string, string | undefined> = {
        indicacao_geografica: common.indicacao_geografica,
        denominacao: common.denominacao,
        capacidade_unitaria: common.capacidade_unitaria,
        numero_lote: common.numero_lote,
      };

      if (teorAlcool) res.teor_alcoolico = teorAlcool;
      if (registroMapa) res.registro_mapa = registroMapa;
      if (alergenicos) res.alergênicos_avisos = alergenicos;

      return res;
    }

    default:
      return {
        observacoes: "Documento anexado para suporte à análise regulatória.",
      };
  }
}
