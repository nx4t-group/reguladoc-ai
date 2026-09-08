"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { AUDIT_ACTIONS, logAuditEvent } from "@/lib/audit";
import { calculateTotalVolume } from "@/lib/rules/calculations";
import { prisma } from "@/lib/prisma";
import { requireTenant } from "@/lib/tenant";

const createDossierSchema = z.object({
  internalNumber: z.string().min(2),
  importerName: z.string().min(2),
  exporterName: z.string().optional(),
  producerName: z.string().optional(),
  countryOrigin: z.string().optional(),
  productName: z.string().min(2),
  brand: z.string().min(1),
  vintage: z.string().optional(),
  geographicalIndication: z.string().optional(),
  batchNumber: z.string().optional(),
  packageType: z.string().optional(),
  packageCount: z.coerce.number().int().positive().optional(),
  unitsPerPackage: z.coerce.number().int().positive().optional(),
  unitCapacityLiters: z.coerce.number().positive().optional(),
  informedVolumeLiters: z.coerce.number().positive().optional(),
});

export type CreateDossierInput = z.infer<typeof createDossierSchema>;

export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  data?: T;
}

export async function createDossier(input: CreateDossierInput): Promise<ActionResult<{ id: string }>> {
  const tenant = await requireTenant();
  const parsed = createDossierSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }
  const values = parsed.data;

  const calculatedVolumeLiters =
    values.packageCount && values.unitsPerPackage && values.unitCapacityLiters
      ? calculateTotalVolume(values.packageCount, values.unitsPerPackage, values.unitCapacityLiters)
      : null;

  const existing = await prisma.dossier.findFirst({
    where: { organizationId: tenant.organizationId, internalNumber: values.internalNumber, deletedAt: null },
  });
  if (existing) {
    return { ok: false, error: `Já existe um dossiê com o número "${values.internalNumber}".` };
  }

  const dossier = await prisma.dossier.create({
    data: {
      organizationId: tenant.organizationId,
      internalNumber: values.internalNumber,
      importerName: values.importerName,
      exporterName: values.exporterName || null,
      producerName: values.producerName || null,
      countryOrigin: values.countryOrigin || null,
      productCategory: "vinho",
      productName: values.productName,
      brand: values.brand,
      vintage: values.vintage || null,
      geographicalIndication: values.geographicalIndication || null,
      batchNumber: values.batchNumber || null,
      packageType: values.packageType || null,
      packageCount: values.packageCount ?? null,
      unitsPerPackage: values.unitsPerPackage ?? null,
      unitCapacityLiters: values.unitCapacityLiters ?? null,
      informedVolumeLiters: values.informedVolumeLiters ?? null,
      calculatedVolumeLiters,
      status: "documentos_pendentes",
      assignedToId: tenant.userId,
      createdById: tenant.userId,
    },
  });

  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId: dossier.id,
    action: AUDIT_ACTIONS.DOSSIER_CREATED,
    entityType: "dossier",
    entityId: dossier.id,
    after: { internalNumber: dossier.internalNumber, brand: dossier.brand },
  });

  revalidatePath("/app/dossiers");
  revalidatePath("/app");
  return { ok: true, data: { id: dossier.id } };
}

export async function createDossierAndRedirect(input: CreateDossierInput) {
  const result = await createDossier(input);
  if (result.ok && result.data) {
    redirect(`/app/dossiers/${result.data.id}`);
  }
  return result;
}

const assignSchema = z.object({ dossierId: z.string(), assignedToId: z.string() });

export async function assignDossier(input: z.infer<typeof assignSchema>): Promise<ActionResult> {
  const tenant = await requireTenant();
  const { dossierId, assignedToId } = assignSchema.parse(input);

  const dossier = await prisma.dossier.findFirst({ where: { id: dossierId, organizationId: tenant.organizationId } });
  if (!dossier) return { ok: false, error: "Dossiê não encontrado." };

  await prisma.dossier.update({ where: { id: dossierId }, data: { assignedToId } });
  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId,
    action: AUDIT_ACTIONS.DOSSIER_UPDATED,
    entityType: "dossier",
    entityId: dossierId,
    before: { assignedToId: dossier.assignedToId },
    after: { assignedToId },
  });

  revalidatePath(`/app/dossiers/${dossierId}`);
  return { ok: true };
}

export async function requestCorrection(dossierId: string): Promise<ActionResult> {
  const tenant = await requireTenant();
  const dossier = await prisma.dossier.findFirst({ where: { id: dossierId, organizationId: tenant.organizationId } });
  if (!dossier) return { ok: false, error: "Dossiê não encontrado." };

  await prisma.dossier.update({ where: { id: dossierId }, data: { status: "documentos_pendentes" } });
  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId,
    action: AUDIT_ACTIONS.DOSSIER_STATUS_CHANGED,
    entityType: "dossier",
    entityId: dossierId,
    before: { status: dossier.status },
    after: { status: "documentos_pendentes", reason: "Correção solicitada ao importador/despachante" },
  });

  revalidatePath(`/app/dossiers/${dossierId}`);
  return { ok: true };
}

export async function archiveDossier(dossierId: string): Promise<ActionResult> {
  const tenant = await requireTenant();
  const dossier = await prisma.dossier.findFirst({ where: { id: dossierId, organizationId: tenant.organizationId } });
  if (!dossier) return { ok: false, error: "Dossiê não encontrado." };

  await prisma.dossier.update({ where: { id: dossierId }, data: { status: "arquivado" } });
  await logAuditEvent({
    organizationId: tenant.organizationId,
    userId: tenant.userId,
    dossierId,
    action: AUDIT_ACTIONS.DOSSIER_STATUS_CHANGED,
    entityType: "dossier",
    entityId: dossierId,
    before: { status: dossier.status },
    after: { status: "arquivado" },
  });

  revalidatePath(`/app/dossiers/${dossierId}`);
  revalidatePath("/app/dossiers");
  return { ok: true };
}
