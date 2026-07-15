import { expect, test, type Page } from '@playwright/test'

import { addSimpleProduct, installMockApi, login, openTable } from './mock-api'

const screenshotDir = '../../docs/waiter/screenshots'

test('login em celular pequeno — 360 × 800', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 })
  await page.goto('/login')
  await capture(page, 'login-360x800.png')
})

test('mesas livres — 390 × 844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page)
  await login(page)
  await page.getByRole('button', { name: 'Livres' }).click()
  await capture(page, 'tables-free-390x844.png')
})

test('mesas ocupadas em tablet — 768 × 1024', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await installMockApi(page)
  await login(page)
  await page.getByRole('button', { name: 'Ocupadas' }).click()
  await capture(page, 'tables-occupied-768x1024.png')
})

test('comanda e item pronto — 1024 × 768', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await installMockApi(page, { occupied: true, ready: true })
  await login(page)
  await page.getByRole('link', { name: /Mesa 01/ }).click()
  await expect(page.getByText('Prontos para levar')).toBeVisible()
  await capture(page, 'ready-order-1024x768.png')
})

test('catálogo em desktop operacional — 1366 × 768', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 })
  await installMockApi(page, { occupied: true })
  await login(page)
  await page.getByRole('link', { name: /Mesa 01/ }).click()
  await page.getByRole('button', { name: 'Adicionar produtos' }).click()
  await capture(page, 'catalog-1366x768.png')
})

test('adicionais obrigatórios — 390 × 844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page)
  await login(page)
  await openTable(page)
  await page.getByRole('button', { name: 'Adicionar produtos' }).click()
  await page.getByRole('button', { name: /Combo da Casa/ }).click()
  await page.getByRole('button', { name: /^Adicionar ·/ }).click()
  await capture(page, 'modifiers-required-390x844.png')
})

test('comanda com rascunho — 768 × 1024', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 })
  await installMockApi(page)
  await login(page)
  await openTable(page)
  await addSimpleProduct(page)
  await page.locator('.draft-bar').click()
  await capture(page, 'draft-order-768x1024.png')
})

test('pedido enviado — 390 × 844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page)
  await login(page)
  await openTable(page)
  await addSimpleProduct(page)
  await page.locator('.draft-bar').click()
  await page.getByRole('button', { name: 'Enviar para produção' }).click()
  await expect(page.getByText('Itens confirmados e enviados para produção.')).toBeVisible()
  await capture(page, 'order-sent-390x844.png')
})

test('offline com rascunho preservado — 390 × 844', async ({ page, context }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page)
  await login(page)
  await openTable(page)
  await addSimpleProduct(page)
  await context.setOffline(true)
  await page.locator('.draft-bar').click()
  await expect(page.getByRole('button', { name: 'Enviar para produção' })).toBeDisabled()
  await capture(page, 'offline-draft-390x844.png')
  await context.setOffline(false)
})

test('conflito de concorrência — 390 × 844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page, { sendFailure: 'conflict' })
  await login(page)
  await openTable(page)
  await addSimpleProduct(page)
  await page.locator('.draft-bar').click()
  await page.getByRole('button', { name: 'Enviar para produção' }).click()
  await expect(page.getByText('Comanda atualizada')).toBeVisible()
  await capture(page, 'conflict-390x844.png')
})

test('erro de produto indisponível — 390 × 844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page, { sendFailure: 'unavailable' })
  await login(page)
  await openTable(page)
  await addSimpleProduct(page)
  await page.locator('.draft-bar').click()
  await page.getByRole('button', { name: 'Enviar para produção' }).click()
  await expect(page.getByText('Um ou mais produtos estão indisponíveis para o salão.')).toBeVisible()
  await capture(page, 'unavailable-error-390x844.png')
})

test('fechamento solicitado — 390 × 844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await installMockApi(page, { occupied: true })
  await login(page)
  await page.getByRole('link', { name: /Mesa 01/ }).click()
  await page.getByRole('button', { name: 'Solicitar fechamento' }).click()
  await page.getByRole('button', { name: 'Solicitar ao caixa' }).click()
  await expect(page.getByText('Fechamento solicitado', { exact: true })).toBeVisible()
  await capture(page, 'closing-requested-390x844.png')
})

async function capture(page: Page, filename: string) {
  await page.screenshot({ path: `${screenshotDir}/${filename}`, animations: 'disabled' })
}
