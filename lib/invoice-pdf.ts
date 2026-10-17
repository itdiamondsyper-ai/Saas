import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { INVOICE_STATUSES, lookup } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import type { InvoiceDetail } from "@/lib/services/invoices";

// Standard PDF fonts only cover Windows-1252; replace anything else so rendering never throws.
const WIN_ANSI_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
function safe(text: string) {
  return Array.from(text)
    .map((ch) => (ch.charCodeAt(0) < 256 || WIN_ANSI_EXTRA.includes(ch) ? ch : "?"))
    .join("");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of safe(text).split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
        lines.push(line);
        line = word;
      } else line = candidate;
    }
    lines.push(line);
  }
  return lines;
}

/** Renders an invoice to a PDF document (A4, built-in fonts, no external assets). */
export async function renderInvoicePdf(detail: InvoiceDetail): Promise<Uint8Array> {
  const { invoice, items, client, project, workspace } = detail;
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Invoice ${invoice.number}`);
  pdf.setAuthor(workspace.name);
  pdf.setCreator("FlowPilot");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const money = (n: number) => safe(formatCurrency(Number(n), invoice.currency, { cents: true }));

  const ink = rgb(0.1, 0.1, 0.14);
  const muted = rgb(0.45, 0.46, 0.52);
  const brand = rgb(0.31, 0.27, 0.9);
  const line = rgb(0.88, 0.88, 0.91);

  let page: PDFPage = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const margin = 50;
  let y = height - margin;

  const text = (value: string, x: number, yy: number, opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb>; align?: "left" | "right" } = {}) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    const v = safe(value);
    const dx = opts.align === "right" ? x - font.widthOfTextAtSize(v, size) : x;
    page.drawText(v, { x: dx, y: yy, size, font, color: opts.color ?? ink });
  };

  page.drawRectangle({ x: margin, y: y - 26, width: 26, height: 26, color: brand });
  text(workspace.name.slice(0, 1).toUpperCase(), margin + 8, y - 19, { font: bold, size: 14, color: rgb(1, 1, 1) });
  text(workspace.name, margin + 36, y - 12, { font: bold, size: 13 });
  if (workspace.industry) text(workspace.industry, margin + 36, y - 25, { size: 9, color: muted });
  text("INVOICE", width - margin, y - 12, { font: bold, size: 18, align: "right" });
  text(invoice.number, width - margin, y - 27, { size: 10, color: muted, align: "right" });
  text(lookup(INVOICE_STATUSES, invoice.status).label.toUpperCase(), width - margin, y - 40, { font: bold, size: 8, color: brand, align: "right" });
  y -= 80;

  const col = (width - margin * 2) / 3;
  const block = (title: string, lines: string[], x: number) => {
    text(title.toUpperCase(), x, y, { font: bold, size: 8, color: muted });
    lines.filter(Boolean).forEach((l, i) => text(l, x, y - 15 - i * 13, { size: 10, font: i === 0 ? bold : regular }));
  };
  block("Billed to", [client?.company ?? "Unknown client", client?.contact_name ?? "", client?.email ?? "", client?.address ?? ""], margin);
  block("Dates", [`Issued ${formatDate(invoice.issue_date, "long")}`, `Due ${formatDate(invoice.due_date, "long")}`, invoice.paid_at ? `Paid ${formatDate(invoice.paid_at, "long")}` : ""], margin + col);
  block("Amount due", [invoice.status === "paid" ? money(0) : money(invoice.total), project ? `Project: ${project.name}` : ""], margin + col * 2);
  y -= 85;

  const cols = { desc: margin, qty: width - margin - 200, rate: width - margin - 110, amount: width - margin };
  const header = () => {
    page.drawLine({ start: { x: margin, y: y + 14 }, end: { x: width - margin, y: y + 14 }, thickness: 0.8, color: line });
    text("Description", cols.desc, y, { font: bold, size: 9, color: muted });
    text("Qty", cols.qty, y, { font: bold, size: 9, color: muted, align: "right" });
    text("Rate", cols.rate, y, { font: bold, size: 9, color: muted, align: "right" });
    text("Amount", cols.amount, y, { font: bold, size: 9, color: muted, align: "right" });
    y -= 10;
    page.drawLine({ start: { x: margin, y }, end: { x: width - margin, y }, thickness: 0.8, color: line });
    y -= 16;
  };
  header();

  for (const item of items) {
    const descLines = wrap(item.description, regular, 10, cols.qty - margin - 60);
    const rowHeight = descLines.length * 13 + 8;
    if (y - rowHeight < margin + 120) {
      page = pdf.addPage([595.28, 841.89]);
      y = height - margin;
      header();
    }
    descLines.forEach((l, i) => text(l, cols.desc, y - i * 13));
    text(String(Number(item.quantity)), cols.qty, y, { align: "right" });
    text(money(item.unit_price), cols.rate, y, { align: "right" });
    text(money(item.amount), cols.amount, y, { font: bold, align: "right" });
    y -= rowHeight;
    page.drawLine({ start: { x: margin, y: y + 6 }, end: { x: width - margin, y: y + 6 }, thickness: 0.5, color: line });
  }

  y -= 10;
  const totalsX = width - margin - 180;
  const totalRow = (label: string, value: string, strong = false) => {
    text(label, totalsX, y, { font: strong ? bold : regular, size: strong ? 12 : 10, color: strong ? ink : muted });
    text(value, width - margin, y, { font: strong ? bold : regular, size: strong ? 12 : 10, align: "right" });
    y -= strong ? 20 : 16;
  };
  totalRow("Subtotal", money(invoice.subtotal));
  totalRow(`Tax (${Number(invoice.tax_rate)}%)`, money(invoice.tax));
  page.drawLine({ start: { x: totalsX, y: y + 10 }, end: { x: width - margin, y: y + 10 }, thickness: 0.8, color: line });
  y -= 4;
  totalRow("Total", money(invoice.total), true);

  if (invoice.notes) {
    y -= 20;
    text("NOTES", margin, y, { font: bold, size: 8, color: muted });
    y -= 14;
    for (const l of wrap(invoice.notes, regular, 9, width - margin * 2)) {
      if (y < margin) break;
      text(l, margin, y, { size: 9, color: muted });
      y -= 12;
    }
  }
  text(`Generated by FlowPilot`, margin, margin - 20, { size: 7, color: muted });
  return pdf.save();
}
