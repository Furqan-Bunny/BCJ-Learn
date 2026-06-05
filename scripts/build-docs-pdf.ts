/**
 * BCJ Learn — render the Markdown guides in /docs to standalone PDFs.
 *
 * Reads every /docs/<name>.md, converts to styled HTML (marked), and prints
 * each to /docs/pdf/<name>.pdf via headless Chrome (puppeteer), with a BCJ
 * header/footer and page numbers.
 *
 * Run with:   npm run docs:pdf
 * (Dev-only. Never imported by the app.)
 */

import { promises as fs } from "fs";
import path from "path";
import { marked } from "marked";
import puppeteer from "puppeteer";

const NAVY = "#041D39";
const TEAL = "#12D7CD";

const DOCS = [
  { slug: "platform-overview", title: "Platform Overview" },
  { slug: "admin-guide", title: "Admin Guide" },
  { slug: "dept-lead-guide", title: "Department Lead Guide" },
  { slug: "employee-guide", title: "Employee Guide" },
  { slug: "faq", title: "FAQ" },
];

function pageHtml(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #1a2330; line-height: 1.55; font-size: 12px; margin: 0; }
    .doc { padding: 8px 4px; }
    h1 { color: ${NAVY}; font-size: 24px; margin: 0 0 4px; border-bottom: 3px solid ${TEAL}; padding-bottom: 8px; }
    h2 { color: ${NAVY}; font-size: 17px; margin: 22px 0 6px; }
    h3 { color: ${NAVY}; font-size: 13.5px; margin: 16px 0 4px; }
    p, li { font-size: 12px; }
    ul, ol { margin: 6px 0 6px 18px; padding: 0; }
    li { margin: 2px 0; break-inside: avoid; }
    code { background: #f1f4f8; padding: 1px 4px; border-radius: 3px; font-size: 11px; }
    pre { background: #f1f4f8; padding: 10px 12px; border-radius: 6px; overflow-x: auto; font-size: 10.5px; break-inside: avoid; }
    table { border-collapse: collapse; width: 100%; margin: 8px 0; break-inside: avoid; }
    th, td { border: 1px solid #d8dee6; padding: 5px 8px; text-align: left; font-size: 11px; }
    th { background: ${NAVY}; color: #fff; }
    h1, h2, h3 { break-after: avoid; }
    blockquote { border-left: 3px solid ${TEAL}; margin: 8px 0; padding: 2px 12px; color: #46505e; background: #f6fdfd; }
    a { color: ${NAVY}; }
  </style></head><body><div class="doc">${body}</div></body></html>`;
}

function headerFooter(title: string) {
  const header = `<div style="font-size:8px;width:100%;padding:0 14mm;color:#7a8594;display:flex;justify-content:space-between;">
    <span>BCJ Learn — ${title}</span><span>BCJ Building Services</span></div>`;
  const footer = `<div style="font-size:8px;width:100%;padding:0 14mm;color:#7a8594;text-align:right;">
    Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`;
  return { header, footer };
}

async function main() {
  const docsDir = path.join(process.cwd(), "docs");
  const outDir = path.join(docsDir, "pdf");
  await fs.mkdir(outDir, { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  try {
    for (const d of DOCS) {
      const md = await fs.readFile(path.join(docsDir, `${d.slug}.md`), "utf8");
      const body = await marked.parse(md);
      const html = pageHtml(d.title, body);
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });
      const { header, footer } = headerFooter(d.title);
      await page.pdf({
        path: path.join(outDir, `${d.slug}.pdf`),
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: header,
        footerTemplate: footer,
        margin: { top: "18mm", bottom: "16mm", left: "14mm", right: "14mm" },
      });
      await page.close();
      console.log(`✓ docs/pdf/${d.slug}.pdf`);
    }
  } finally {
    await browser.close();
  }
  console.log(`\nDone — ${DOCS.length} PDFs in docs/pdf/`);
}

main().catch((e) => { console.error(e); process.exit(1); });
