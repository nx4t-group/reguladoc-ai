import path from "node:path";
import { expect, test } from "@playwright/test";

const FIXTURE_PDF = path.join(__dirname, "fixtures", "sample-invoice.pdf");

test("fluxo dourado: login → dashboard → criar dossiê → upload → validação → alertas → revisão → relatório", async ({ page }) => {
  // 1. Login com conta de demonstração
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("analista@demo.com");
  await page.getByLabel("Senha").fill("demo1234");
  await page.getByRole("button", { name: "Entrar" }).click();

  // 2. Dashboard (aguarda a navegação explicitamente — o primeiro acesso a /app
  // em modo dev pode levar mais tempo para compilar do que o timeout padrão de asserção)
  await page.waitForURL(/\/app$/, { timeout: 30_000 });
  await expect(page.getByText(/Bem-vindo\(a\)/)).toBeVisible();
  await expect(page.getByText("Total de dossiês")).toBeVisible();

  // 3. Criar dossiê
  await page.goto("/app/dossiers/new");
  await page.getByRole("button", { name: /Preencher com exemplo/ }).click();
  const internalNumber = `E2E-${Date.now()}`;
  await page.getByLabel("Número interno do processo").fill(internalNumber);
  await page.getByRole("button", { name: "Criar dossiê" }).click();

  await expect(page).toHaveURL(/\/app\/dossiers\/[a-z0-9]+$/);
  await expect(page.getByRole("heading", { name: internalNumber })).toBeVisible();

  // 4. Upload de documento — extração e validação já rodam automaticamente
  // como parte da própria action de upload (ver src/server/actions/documents.ts).
  await page.getByRole("tab", { name: /^Documentos/ }).click();
  await page.setInputFiles('input[type="file"]', FIXTURE_PDF);
  await expect(page.getByText("sample-invoice.pdf")).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("Concluída")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Score:/)).toBeVisible({ timeout: 15_000 });

  // 5. Revalidar manualmente (o rótulo já muda para "Revalidar" pois a
  // validação automática do upload já rodou uma vez)
  await page.getByRole("button", { name: /Executar validação|Revalidar/ }).click();
  await expect(page.getByText(/Score:/)).toBeVisible({ timeout: 15_000 });

  // 6. Ver alertas (documentos obrigatórios ausentes, já que só 1 documento foi enviado)
  await page.getByRole("tab", { name: /^Alertas/ }).click();
  await expect(page.getByText(/Documento obrigatório ausente/).first()).toBeVisible();

  // 7. Revisar alerta na tela de revisão focada
  await page.getByRole("link", { name: "Ir para revisão" }).click();
  await expect(page).toHaveURL(/\/review$/);
  await expect(page.getByRole("heading", { name: "Revisão de alertas" })).toBeVisible();
  await page.getByPlaceholder(/Justifique a decisão/).fill("Documento será enviado em complementação — revisado pelo analista de teste.");
  await page.getByRole("button", { name: "Marcar como resolvido" }).first().click();
  await expect(page.getByText(/Score recalculado/)).toBeVisible({ timeout: 10_000 });

  // 8. Gerar parecer de conformidade
  await page.goBack();
  await page.getByRole("tab", { name: "Relatório" }).click();
  await page.getByRole("tabpanel").getByRole("button", { name: /Gerar parecer/ }).click();
  await expect(page.getByText("Parecer de Conformidade Documental")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("button", { name: /Exportar \/ Imprimir PDF/ })).toBeEnabled();
});
