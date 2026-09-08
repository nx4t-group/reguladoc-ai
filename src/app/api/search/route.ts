import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getCurrentSession } from "@/lib/tenant";

export async function GET(request: NextRequest) {
  const session = await getCurrentSession();
  if (!session?.user) {
    return NextResponse.json({ dossiers: [] }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ dossiers: [] });
  }

  const dossiers = await prisma.dossier.findMany({
    where: {
      organizationId: session.user.organizationId,
      deletedAt: null,
      OR: [
        { internalNumber: { contains: query } },
        { importerName: { contains: query } },
        { brand: { contains: query } },
        { productName: { contains: query } },
        { batchNumber: { contains: query } },
      ],
    },
    select: {
      id: true,
      internalNumber: true,
      importerName: true,
      brand: true,
      productName: true,
      status: true,
    },
    take: 8,
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ dossiers });
}
