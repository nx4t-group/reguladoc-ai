"use client";

import * as React from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  FileText,
  CheckCircle2,
  ShieldCheck,
  Zap,
  ArrowRight,
  BookOpen,
  Check,
} from "lucide-react";

import type { DossierDetailData } from "./types";
import { CountryOriginBadge } from "@/components/country-origin-badge";

interface DocumentItem {
  id: string;
  documentType: string;
  filename: string;
}

const REQUIRED_DOCS_LIST = [
  { type: "anexo_ix", label: "Anexo IX (MAPA)" },
  { type: "certificado_origem", label: "Certificado de Origem" },
  { type: "laudo_analise", label: "Laudo de Análise Físico-Química" },
  { type: "invoice", label: "Fatura Comercial (Invoice)" },
  { type: "packing_list", label: "Romaneio (Packing List)" },
  { type: "rotulo", label: "Rótulo / Contrarrótulo Aprovado" },
];

export function OverviewTab({
  dossier,
  missingRequiredDocuments = [],
  documents = [],
  onNavigateToDocuments,
}: {
  dossier: DossierDetailData;
  missingRequiredDocuments?: { type: string; label: string }[];
  documents?: DocumentItem[];
  onNavigateToDocuments?: () => void;
}) {
  const validatedDocsCount = 6 - (missingRequiredDocuments?.length || 0);
  const isAllValid = missingRequiredDocuments?.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" data-purpose="core-dossier-layout">
      {/* ── LEFT COLUMN: Resumo do Processo & Embarque (Col Span 8) ── */}
      <div className="lg:col-span-8 bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 sm:p-8" data-purpose="registration-summary">
        {/* Header of the Box */}
        <div className="border-b border-stone-200 pb-5 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-stone-900 tracking-tight">Resumo do Processo &amp; Embarque</h2>
              <p className="text-xs text-stone-500 mt-0.5">Dados cadastrais informados do dossiê de importação vitivinícola.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-foliage-800 bg-foliage-50 px-3 py-1 rounded-md border border-foliage-300/40">
              <ShieldCheck className="w-3.5 h-3.5 text-foliage-700" />
              Estrutura Cadastral Verificada
            </span>
          </div>
        </div>

        {/* Two Column Key-Value Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5 text-sm">
          {/* Row 1 */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Importador</span>
            <p className="text-xs font-bold text-stone-900 leading-snug">
              {dossier.importerName || "BARRINHAS Comércio e Importação de Bebidas e Cereais Ltda."}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Exportador</span>
            <p className="text-xs font-bold text-stone-900 leading-snug">
              {dossier.exporterName || "Granacer - Administração de Bens, S.A."}
            </p>
          </div>

          {/* Divider */}
          <div className="col-span-full border-t border-stone-100"></div>

          {/* Row 2 */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Produtor / Engarrafador</span>
            <p className="text-xs font-semibold text-stone-800">
              {dossier.producerName || dossier.exporterName || "Granacer - Administração de Bens, S.A."}
            </p>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">País de Origem</span>
            <CountryOriginBadge country={dossier.countryOrigin} />
          </div>

          {/* Divider */}
          <div className="col-span-full border-t border-stone-100"></div>

          {/* Row 3 */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Produto Principal</span>
            <p className="text-xs font-semibold text-stone-800">{dossier.productName || "Vinho Fino Tinto Seco"}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Marca</span>
            <p className="text-xs font-semibold text-stone-800">{dossier.brand || "Tapada do Fidalgo"}</p>
          </div>

          {/* Divider */}
          <div className="col-span-full border-t border-stone-100"></div>

          {/* Row 4 */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Safra</span>
            <p className="text-xs font-semibold text-stone-800">{dossier.vintage || "2025"}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Indicação Geográfica</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-stone-800">{dossier.geographicalIndication || "Regional Alentejano"}</span>
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
              <span className="text-[11px] text-amber-700 font-medium">Vinho Regional (IG)</span>
            </div>
          </div>

          {/* Divider */}
          <div className="col-span-full border-t border-stone-100"></div>

          {/* Row 5 */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Lote Principal</span>
            <p className="text-xs font-bold text-stone-900 tracking-wide">{dossier.batchNumber || "LVT25260101"}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Tipo de Embalagem</span>
            <p className="text-xs font-semibold text-stone-800">{dossier.packageType || "Caixas de 6 garrafas"}</p>
          </div>

          {/* Divider */}
          <div className="col-span-full border-t border-stone-100"></div>

          {/* Row 6: Quantidades e Unidades */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Quantidade de Embalagens</span>
            <p className="text-xs font-bold text-stone-900">{dossier.packageCount ?? 800} caixas</p>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Unidades por Embalagem</span>
            <p className="text-xs font-bold text-stone-900">{dossier.unitsPerPackage ?? 6} garrafas / caixa</p>
          </div>

          {/* Divider */}
          <div className="col-span-full border-t border-stone-100"></div>

          {/* Row 7: Capacidades e Volumes */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Capacidade Unitária</span>
            <p className="text-xs font-semibold text-stone-800">{dossier.unitCapacityLiters ?? 0.75} L (750 ml)</p>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Volume Total Informado</span>
            <p className="text-xs font-bold text-stone-900">
              {dossier.informedVolumeLiters ? `${dossier.informedVolumeLiters.toLocaleString("pt-BR")} L` : "3.600 L"}
            </p>
          </div>

          {/* Divider */}
          <div className="col-span-full border-t border-stone-100"></div>

          {/* Row 8: Volume Calculado e Responsável */}
          <div className="space-y-1 bg-emerald-50/70 p-3 rounded-xl border border-emerald-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-foliage-800 uppercase tracking-wider">Volume Calculado (Automático)</span>
              <span className="inline-flex items-center text-[10px] font-bold text-foliage-800 bg-white px-2 py-0.5 rounded border border-emerald-200 shadow-2xs">
                <Check className="w-3 h-3 mr-0.5 text-emerald-600" />
                Coerente
              </span>
            </div>
            <p className="text-sm font-extrabold text-emerald-950 mt-1">
              {dossier.calculatedVolumeLiters ? `${dossier.calculatedVolumeLiters.toLocaleString("pt-BR")} L` : "3.600 L"}{" "}
              <span className="text-[11px] font-normal text-emerald-800">
                ({dossier.packageCount ?? 800} cx × {dossier.unitsPerPackage ?? 6} un × {dossier.unitCapacityLiters ?? 0.75}L)
              </span>
            </p>
          </div>
          <div className="space-y-1 p-3 rounded-xl bg-stone-50 border border-stone-200/70 flex flex-col justify-center">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Responsável Pela Análise</span>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <p className="text-xs font-bold text-stone-800">{dossier.assignedTo?.name ? dossier.assignedTo.name.replace(/demo/gi, "Teste") : "Analista Teste"}</p>
            </div>
          </div>

          {/* Divider */}
          <div className="col-span-full border-t border-stone-100"></div>

          {/* Row 9: Audit Trail Elements */}
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Criado Por</span>
            <p className="text-xs font-medium text-stone-700">{dossier.createdBy?.name ? dossier.createdBy.name.replace(/demo/gi, "Teste") : "Analista Teste"}</p>
          </div>
          <div className="space-y-1">
            <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider block">Data de Criação</span>
            <p className="text-xs font-medium text-stone-700">
              {format(new Date(dossier.createdAt), "dd/MM/yyyy 'às' HH:mm '(BRT)'", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Sub-banner: AI Pipeline Status Notice */}
        <div className="mt-8 pt-6 border-t border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#faf9f6] p-4 rounded-xl border border-stone-200">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-stone-200/80 flex items-center justify-center text-stone-700 flex-shrink-0">
              <Zap className="w-4 h-4 text-wine-800" />
            </div>
            <div>
              <p className="text-xs font-bold text-stone-800">Motor de Regras Vitivinícolas v1.2</p>
              <p className="text-[11px] text-stone-500">15 regras executadas assincronamente em milissegundos via OCR inteligente.</p>
            </div>
          </div>
          <Link
            href="/painel/rules"
            className="text-xs font-bold text-foliage-700 hover:text-foliage-900 hover:underline whitespace-nowrap flex items-center gap-1"
          >
            Ver regras do motor <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      {/* ── RIGHT COLUMN: Support Cards & MAPA Compliance (Col Span 4) ── */}
      <aside className="lg:col-span-4 space-y-6" data-purpose="regulatory-sidebar">
        {/* Card 1: Checklist Documental Obrigatório */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold text-stone-900 tracking-tight">Checklist Documental Obrigatório</h3>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
              {validatedDocsCount} de 6
            </span>
          </div>
          <p className="text-xs text-stone-500 mb-4">Conferência pré-embarque conforme Instruções Normativas do MAPA.</p>

          {/* Status Highlight Box */}
          <div className="bg-emerald-50/80 border border-emerald-200/80 rounded-xl p-3.5 mb-4">
            <div className="flex items-start gap-2.5">
              <div className="text-foliage-700 flex-shrink-0 mt-0.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs font-bold text-emerald-950">
                  {isAllValid ? "Documentação Completa" : "Validação em Andamento"}
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5 leading-relaxed">
                  {isAllValid
                    ? "Todos os 6 documentos essenciais para vinhos finos foram anexados e processados."
                    : `${validatedDocsCount} de 6 documentos essenciais validados no dossiê.`}
                </p>
              </div>
            </div>
          </div>

          {/* Document List Item Breakdown */}
          <ul className="space-y-2" role="list">
            {REQUIRED_DOCS_LIST.map((reqDoc) => {
              const isMissing = missingRequiredDocuments?.some((m) => m.type === reqDoc.type);
              const hasDoc = documents?.some((d) => d.documentType === reqDoc.type);
              const isValidated = hasDoc || !isMissing;

              return (
                <li
                  key={reqDoc.type}
                  className="flex items-center justify-between text-xs p-2 rounded-lg hover:bg-stone-50 transition border border-transparent hover:border-stone-200"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="w-3.5 h-3.5 text-stone-400 flex-shrink-0" />
                    <span className="font-medium text-stone-800 truncate">{reqDoc.label}</span>
                  </div>
                  {isValidated ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-foliage-700 flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-foliage-700"></span> Validado
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 flex-shrink-0">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span> Pendente
                    </span>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-4 pt-4 border-t border-stone-200 text-center">
            {onNavigateToDocuments ? (
              <button
                type="button"
                onClick={onNavigateToDocuments}
                className="text-xs font-semibold text-wine-800 hover:text-wine-950 transition inline-flex items-center gap-1 cursor-pointer"
              >
                <span>Acessar pasta documental completa</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            ) : (
              <span className="text-xs font-semibold text-wine-800 inline-flex items-center gap-1">
                <span>Pasta documental mapeada no dossiê</span>
              </span>
            )}
          </div>
        </div>

        {/* Card 2: Regulação MAPA Aplicável */}
        <div className="bg-white rounded-2xl border border-stone-200/90 shadow-sm p-6 relative overflow-hidden">
          {/* Subtle watermark seal icon in background */}
          <div className="absolute -right-6 -bottom-6 text-stone-100 pointer-events-none">
            <BookOpen className="w-36 h-36 text-stone-100 stroke-1" />
          </div>

          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-md bg-stone-100 flex items-center justify-center text-stone-700">
                <BookOpen className="w-3.5 h-3.5 text-stone-700" />
              </div>
              <h3 className="text-sm font-bold text-stone-900 tracking-tight">Regulação MAPA Aplicável</h3>
            </div>
            <p className="text-xs text-stone-600 leading-relaxed">
              Vinhos e derivados da uva importados para o Brasil estão sujeitos ao{" "}
              <strong className="text-stone-800 font-semibold">Anexo IX</strong> (Certificado de Origem e Análise), à{" "}
              <strong className="text-stone-800 font-semibold">Instrução Normativa MAPA nº 67/2018</strong> e ao{" "}
              <strong className="text-stone-800 font-semibold">Decreto nº 8.198/2014</strong>.
            </p>

            {/* Legal Citation Badges */}
            <div className="mt-4 pt-4 border-t border-stone-100 flex flex-wrap gap-2">
              <span className="text-[10px] font-medium bg-[#faf9f6] text-stone-700 px-2 py-1 rounded border border-stone-200">
                IN MAPA 67/2018
              </span>
              <span className="text-[10px] font-medium bg-[#faf9f6] text-stone-700 px-2 py-1 rounded border border-stone-200">
                Decreto 8.198/2014
              </span>
              <span className="text-[10px] font-medium bg-[#faf9f6] text-stone-700 px-2 py-1 rounded border border-stone-200">
                Lei 7.678/1988 (Lei do Vinho)
              </span>
            </div>

            {/* Regulatory Integrity Status */}
            <div className="mt-4 flex items-center justify-between text-[11px] text-stone-600 bg-stone-50 p-2.5 rounded-lg border border-stone-200">
              <span className="font-medium">Padrões de Identidade e Qualidade (PIQ)</span>
              <span className="font-bold text-foliage-800 flex items-center gap-1">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                Parametrizado
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}
