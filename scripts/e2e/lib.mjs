// Utilidades para las pruebas de punta a punta con Edge/Chrome instalados.
// Uso: node scripts/e2e/<prueba>.mjs   (con `npm run dev` corriendo)
import puppeteer from "puppeteer-core";
import fs from "node:fs";
import path from "node:path";

export const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

const CANDIDATES = [
  process.env.E2E_BROWSER,
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

export async function launch({ mobile = false } = {}) {
  const executablePath = CANDIDATES.find((p) => fs.existsSync(p));
  if (!executablePath) throw new Error("No encontré Edge ni Chrome. Define E2E_BROWSER.");
  const browser = await puppeteer.launch({ executablePath, headless: true, args: ["--no-first-run"] });
  const page = await browser.newPage();
  await page.setViewport(mobile ? { width: 390, height: 844, isMobile: true, hasTouch: true } : { width: 1366, height: 900 });
  page.on("pageerror", (e) => console.log("  [error en página]", e.message));
  return { browser, page };
}

export const outDir = process.env.E2E_OUT ?? path.resolve("e2e-output");
fs.mkdirSync(outDir, { recursive: true });

export async function shot(page, name, fullPage = true) {
  const file = path.join(outDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  return file;
}

export function step(msg) {
  console.log(`• ${msg}`);
}

export function assert(cond, msg) {
  if (!cond) throw new Error(`FALLÓ: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

export async function clickText(page, selector, text) {
  const handles = await page.$$(selector);
  for (const h of handles) {
    const t = await h.evaluate((el) => el.textContent?.trim() ?? "");
    if (t.includes(text)) {
      await h.click();
      return;
    }
  }
  throw new Error(`No encontré ${selector} con texto "${text}"`);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
