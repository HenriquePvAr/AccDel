import { expect, test } from '@playwright/test'

import { addSimpleProduct, installMockApi, login, openTable } from './mock-api'

test('Fluxo A — abre mesa, adiciona produto simples e envia', async ({ page }) => {
  await installMockApi(page)
  await login(page)
  await openTable(page)
  await addSimpleProduct(page)
  await page.locator('.draft-bar').click()
  await page.getByRole('button', { name: 'Enviar para produção' }).click()
  await expect(page.getByText('Itens confirmados e enviados para produção.')).toBeVisible()
})

test('Fluxo B — exige adicional, aceita observação e envia', async ({ page }) => {
  await installMockApi(page)
  await login(page)
  await openTable(page)
  await page.getByRole('button', { name: 'Adicionar produtos' }).click()
  await page.getByRole('button', { name: /Combo da Casa/ }).click()
  await page.getByRole('button', { name: /^Adicionar ·/ }).click()
  await expect(page.getByText('Complete as escolhas obrigatórias.')).toBeVisible()
  await page.getByLabel(/Batata frita/).check()
  await page.getByLabel(/Observação para a cozinha/).fill('Molho separado')
  await page.getByRole('button', { name: /^Adicionar ·/ }).click()
  await page.getByRole('button', { name: 'Voltar para comanda' }).click()
  await page.locator('.draft-bar').click()
  await page.getByRole('button', { name: 'Enviar para produção' }).click()
  await expect(page.getByText('Itens confirmados e enviados para produção.')).toBeVisible()
})

test('Fluxo C — produto indisponível no envio exige revisão', async ({ page }) => {
  await installMockApi(page, { sendFailure: 'unavailable' })
  await login(page)
  await openTable(page)
  await addSimpleProduct(page)
  await page.locator('.draft-bar').click()
  await page.getByRole('button', { name: 'Enviar para produção' }).click()
  await expect(page.getByText('Um ou mais produtos estão indisponíveis para o salão.')).toBeVisible()
  await expect(page.getByText('Burger Cain', { exact: true })).toBeVisible()
})

test('Fluxo D — adição posterior envia somente os itens novos', async ({ page }) => {
  const mock = await installMockApi(page, { occupied: true })
  await login(page)
  await page.getByRole('link', { name: /Mesa 01/ }).click()
  await addSimpleProduct(page)
  await page.locator('.draft-bar').click()
  await page.getByRole('button', { name: 'Enviar para produção' }).click()
  await expect.poll(() => mock.getLastSendItems().length).toBe(1)
})

test('Fluxo E — conflito preserva rascunho e pede revisão', async ({ page }) => {
  await installMockApi(page, { sendFailure: 'conflict' })
  await login(page)
  await openTable(page)
  await addSimpleProduct(page)
  await page.locator('.draft-bar').click()
  await page.getByRole('button', { name: 'Enviar para produção' }).click()
  await expect(page.getByText('Esta comanda foi atualizada em outro dispositivo. Revise as alterações antes de continuar.')).toBeVisible()
  await expect(page.getByText('Burger Cain', { exact: true })).toBeVisible()
})

test('Fluxo F — offline bloqueia envio e reconexão permite continuar', async ({ page, context }) => {
  await installMockApi(page)
  await login(page)
  await openTable(page)
  await addSimpleProduct(page)
  await context.setOffline(true)
  await page.locator('.draft-bar').click()
  await expect(page.getByRole('button', { name: 'Enviar para produção' })).toBeDisabled()
  await expect(page.getByText(/Sem conexão: o rascunho está preservado/)).toBeVisible()
  await context.setOffline(false)
  await expect(page.getByRole('button', { name: 'Enviar para produção' })).toBeEnabled()
})

test('Fluxo G — solicita fechamento sem confirmar pagamento', async ({ page }) => {
  await installMockApi(page, { occupied: true })
  await login(page)
  await page.getByRole('link', { name: /Mesa 01/ }).click()
  await page.getByRole('button', { name: 'Solicitar fechamento' }).click()
  await page.getByRole('button', { name: 'Solicitar ao caixa' }).click()
  await expect(page.getByText('Fechamento solicitado ao caixa.')).toBeVisible()
  await expect(page.getByText('O pagamento continua sob responsabilidade financeira.')).toBeVisible()
})
