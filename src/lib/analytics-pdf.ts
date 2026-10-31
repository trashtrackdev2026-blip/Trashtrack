import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AnalyticsPoint } from "./analytics-data.ts";

export type AnalyticsPdfSection = { title: string; rows: AnalyticsPoint[] };

export async function buildAnalyticsPdf(sections: AnalyticsPdfSection[], notes: string[] = [], now = new Date()) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.14, 0.29, 0.2), muted = rgb(0.35, 0.4, 0.36), green = rgb(0.3, 0.5, 0.35);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 790;
  const clean = (text: string) => text.replace(/[^\x20-\x7e]/g, "-");
  const newPage = () => { page = pdf.addPage([595.28, 841.89]);y = 790; };
  function line(text: string, size = 11, heading = false) {
    if (y < 65) newPage();
    page.drawText(clean(text), { x: 42, y, size, font: heading ? bold : font, color: heading ? ink : muted });y -= size + 10;
  }
  function paragraph(text: string) {
    const words = clean(text).split(/\s+/);let row = "";
    for (const word of words) {
      if (font.widthOfTextAtSize(row + " " + word, 10) > 500 && row) {line(row, 10);row = word;} else row += (row ? " " : "") + word;
    }
    if (row) line(row, 10);
  }
  line("TrashTrack | Reports & Analytics", 20, true);
  line("Balete, Batangas - " + now.toLocaleString("en-PH", { timeZone: "Asia/Manila" }) + " (Asia/Manila)", 10);
  for (const note of notes) paragraph(note);
  for (const section of sections) {
    if (y < 130) newPage();
    y -= 12;line(section.title, 14, true);
    const largest = Math.max(1, ...section.rows.map(row => row.value));
    for (const row of section.rows) {
      if (y < 85) { newPage();line(section.title + " (continued)", 14, true); }
      const label = clean(row.name).slice(0, 53);
      page.drawText(label, { x:42, y, size:10, font, color:ink });
      page.drawText(String(row.value), { x:510 - font.widthOfTextAtSize(String(row.value), 10), y, size:10, font:bold, color:ink });
      y -= 12;page.drawRectangle({ x:42, y, width:475, height:5, color:rgb(0.92, 0.94, 0.91) });
      if (row.value > 0) page.drawRectangle({ x:42, y, width:475 * row.value / largest, height:5, color:green });
      y -= 22;
    }
  }
  pdf.getPages().forEach((item, index) => item.drawText(`TrashTrack - Page ${index + 1} of ${pdf.getPageCount()}`, { x:42, y:30, size:9, font, color:muted }));
  pdf.setTitle("TrashTrack Reports and Analytics");
  return pdf.save();
}

export async function downloadAnalyticsPdf(sections: AnalyticsPdfSection[], notes: string[] = [], name = "Analytics") {
  const bytes = await buildAnalyticsPdf(sections, notes);
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type:"application/pdf" }));
  const anchor = document.createElement("a");anchor.href = url;anchor.download = `TrashTrack-${name}.pdf`;anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
