/**
 * HTML do template → PDF no Chromium headless (spec 097, D-A2-2). O browser fica numa promise no
 * escopo do módulo e é reaproveitado entre requisições da mesma instância (Fluid Compute): frio
 * ~3 s, quente ~0 ms (spike 2026-10-03).
 *
 * Segurança (PO-SEC-3/PO-SEC-6): a página roda com JavaScript desligado e sem rede — o documento é
 * só HTML+CSS inline; qualquer requisição de rede (imagem, fonte, fetch) é abortada. Só `data:` passa
 * (o logo embutido — não sai da página).
 */
import chromium from '@sparticuz/chromium'
import puppeteer, { type Browser } from 'puppeteer-core'

let browserPromise: Promise<Browser> | null = null

export function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = (async () =>
      puppeteer.launch({ args: chromium.args, executablePath: await chromium.executablePath(), headless: true }))().catch(
      (err) => {
        browserPromise = null
        throw err
      }
    )
  }
  return browserPromise
}

export async function warmUp(): Promise<void> {
  await getBrowser()
}

export async function renderPdf(html: string, footer: string): Promise<Uint8Array> {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      void (request.url().startsWith('data:') ? request.continue() : request.abort())
    })
    await page.setContent(html, { waitUntil: 'load' })
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', bottom: '16mm', left: '12mm', right: '12mm' },
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: footer,
    })
  } finally {
    await page.close()
  }
}
