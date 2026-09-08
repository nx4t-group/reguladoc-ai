/** Catálogo de campos críticos para vinhos (seção 7.5 do escopo). */

export type FieldGroup = "identificacao" | "produto" | "lote_analise" | "quantidade" | "regulatorio";

export interface FieldDefinition {
  key: string;
  label: string;
  group: FieldGroup;
}

export const FIELD_GROUP_LABELS: Record<FieldGroup, string> = {
  identificacao: "Identificação",
  produto: "Produto",
  lote_analise: "Lote e análise",
  quantidade: "Quantidade",
  regulatorio: "Regulatório",
};

export const FIELD_DEFINITIONS: FieldDefinition[] = [
  // Identificação
  { key: "denominacao", label: "Denominação", group: "identificacao" },
  { key: "marca", label: "Marca", group: "identificacao" },
  { key: "produtor", label: "Produtor / engarrafador", group: "identificacao" },
  { key: "exportador", label: "Exportador", group: "identificacao" },
  { key: "importador", label: "Importador", group: "identificacao" },
  { key: "pais_origem", label: "País de origem", group: "identificacao" },
  { key: "local_descarga", label: "Local de descarga", group: "identificacao" },
  { key: "meio_transporte", label: "Meio de transporte", group: "identificacao" },
  // Produto
  { key: "tipo_produto", label: "Tipo de produto", group: "produto" },
  { key: "cor", label: "Cor", group: "produto" },
  { key: "teor_acucar", label: "Teor de açúcar (seco/suave)", group: "produto" },
  { key: "safra", label: "Safra", group: "produto" },
  { key: "uva", label: "Uva", group: "produto" },
  { key: "indicacao_geografica", label: "Indicação geográfica", group: "produto" },
  { key: "denominacao_origem", label: "Denominação de origem", group: "produto" },
  // Lote e análise
  { key: "numero_lote", label: "Número do lote", group: "lote_analise" },
  { key: "numero_laudo", label: "Número do laudo", group: "lote_analise" },
  { key: "laboratorio", label: "Laboratório", group: "lote_analise" },
  { key: "data_laudo", label: "Data do laudo", group: "lote_analise" },
  { key: "finalidade", label: "Finalidade", group: "lote_analise" },
  { key: "teor_alcoolico", label: "Teor alcoólico", group: "lote_analise" },
  { key: "acidez_total", label: "Acidez total", group: "lote_analise" },
  { key: "acidez_volatil", label: "Acidez volátil", group: "lote_analise" },
  { key: "acucares_totais", label: "Açúcares totais", group: "lote_analise" },
  { key: "metanol", label: "Metanol", group: "lote_analise" },
  { key: "ph", label: "pH", group: "lote_analise" },
  { key: "sulfatos", label: "Sulfatos", group: "lote_analise" },
  { key: "observacao_acreditacao", label: "Observação sobre acreditação", group: "lote_analise" },
  // Quantidade
  { key: "tipo_embalagem", label: "Tipo de embalagem", group: "quantidade" },
  { key: "numero_embalagens", label: "Número de embalagens", group: "quantidade" },
  { key: "unidades_por_embalagem", label: "Unidades por embalagem", group: "quantidade" },
  { key: "capacidade_unitaria", label: "Capacidade unitária (L)", group: "quantidade" },
  { key: "volume_total_informado", label: "Volume total informado (L)", group: "quantidade" },
  { key: "volume_total_calculado", label: "Volume total calculado (L)", group: "quantidade" },
  // Regulatório
  { key: "numero_certificado", label: "Número do certificado", group: "regulatorio" },
  { key: "orgao_emissor", label: "Órgão emissor", group: "regulatorio" },
  { key: "data_emissao", label: "Data de emissão", group: "regulatorio" },
  { key: "referencia_normativa", label: "Referência normativa", group: "regulatorio" },
  { key: "apto_inapto", label: "Apto / inapto", group: "regulatorio" },
  { key: "observacoes", label: "Observações", group: "regulatorio" },
];

export const FIELD_LABELS: Record<string, string> = Object.fromEntries(
  FIELD_DEFINITIONS.map((f) => [f.key, f.label]),
);
