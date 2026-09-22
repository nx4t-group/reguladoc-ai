import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  // Se CRON_SECRET estiver configurado na Vercel, valida a autorização
  const authHeader = request.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startTime = Date.now();

    // 1. Executa consulta SQL direta no PostgreSQL do Supabase para registrar atividade de I/O
    const [dbResult, orgCount] = await Promise.all([
      prisma.$queryRaw`SELECT 1 as alive, NOW() as current_time`,
      prisma.organization.count(),
    ]);

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      durationMs,
      timestamp: new Date().toISOString(),
      organizationCount: orgCount,
      queryResult: dbResult,
      message: "Supabase keep-alive executado com sucesso!",
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Falha na conexão com o banco de dados";
    console.error("[Keep-Alive Cron] Falha ao consultar o banco de dados:", errorMessage);
    return NextResponse.json(
      {
        status: "unhealthy",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
