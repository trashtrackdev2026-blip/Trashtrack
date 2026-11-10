import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { AnalyticsPoint } from "./analytics-data.ts";
import type { AnalyticsRecordRow } from "./analytics-period.ts";

export type AnalyticsPdfSection = { title: string; rows: AnalyticsPoint[]; records?:AnalyticsRecordRow[] };

export async function buildAnalyticsPdf(sections: AnalyticsPdfSection[], notes: string[] = [], now = new Date()) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.08, 0.23, 0.17), muted = rgb(0.28, 0.35, 0.30), green = rgb(0.23, 0.48, 0.32);
  const pale = rgb(0.93, 0.96, 0.91), rule = rgb(0.79, 0.84, 0.78);
  const margin = 42, width = 511, bottom = 54;
  const supported = new Set(font.getCharacterSet());
  const clean = (value: string) => [...value.replace(/\s+/g, " ").trim()].map(character =>
    supported.has(character.codePointAt(0)!) ? character : "?").join("");
  function wrap(value: string, maxWidth: number, size: number, face = font) {
    const lines: string[] = [];
    let line = "";
    for (const word of clean(value).split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (face.widthOfTextAtSize(next, size) <= maxWidth) { line = next; continue; }
      if (line) lines.push(line);
      line = "";
      for (const character of word) {
        if (line && face.widthOfTextAtSize(line + character, size) > maxWidth) { lines.push(line); line = ""; }
        line += character;
      }
    }
    lines.push(line);
    return lines;
  }
  function addPage() {
    const sheet = pdf.addPage([595.28, 841.89]);
    sheet.drawText("TRASHTRACK  /  BALETE, BATANGAS", { x: margin, y: 801, size: 9, font: bold, color: ink });
    sheet.drawLine({ start: { x: margin, y: 791 }, end: { x: margin + width, y: 791 }, thickness: 1, color: rule });
    return sheet;
  }
  let page = addPage();
  let y = 767;
  function newPage() { page = addPage(); y = 767; }
  function ensure(height: number) { if (y - height < bottom) newPage(); }
  function heading(title: string, room: number) {
    const lines = wrap(title, width, 14, bold);
    ensure(lines.length * 17 + 13 + room);
    for (const line of lines) {
      page.drawText(line, { x: margin, y: y - 14, size: 14, font: bold, color: ink });
      y -= 17;
    }
    y -= 13;
  }

  const isRecords = sections.length === 1 && Boolean(sections[0].records);
  const title = isRecords ? "Report records" : "Reports & analytics";
  page.drawText(title, { x: margin, y: y - 24, size: 25, font: bold, color: ink });
  y -= 46;
  const generated = now.toLocaleString("en-PH", { timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short" });
  page.drawText(clean(`Prepared ${generated} (Philippine time)`), { x: margin, y, size: 10, font, color: muted });
  y -= 16;
  const periodNote = notes.find(note => note.startsWith("Selected period:"));
  if (periodNote) {
    const lines = wrap(periodNote, width - 20, 10, bold);
    const height = lines.length * 14 + 12;
    page.drawRectangle({ x: margin, y: y - height, width, height, color: pale });
    lines.forEach((line, index) => page.drawText(line, { x: margin + 10, y: y - 16 - index * 14, size: 10, font: bold, color: ink }));
    y -= height;
  }
  y -= 23;

  const columns = [
    { label: "Submitted (PH)", width: 109 }, { label: "Reference", width: 127 },
    { label: "Barangay", width: 72 }, { label: "Concern", width: 100 }, { label: "Status", width: 103 },
  ];
  const lineHeight = 12;
  const rowPadding = 12;
  function tableHeader() {
    page.drawRectangle({ x: margin, y: y - 24, width, height: 24, color: ink });
    let x = margin;
    for (const column of columns) {
      page.drawText(column.label, { x: x + 7, y: y - 16, size: 9, font: bold, color: rgb(1, 1, 1) });
      x += column.width;
    }
    y -= 24;
  }
  function tableRows(section: AnalyticsPdfSection, records: AnalyticsRecordRow[]) {
    const rows = records.map(row => [row.date, row.reference, row.barangay, row.type, row.status]
      .map((value, index) => wrap(value, columns[index].width - 14, 9)));
    const firstHeight = rows.length ? Math.max(...rows[0].map(cell => cell.length)) * lineHeight + rowPadding : 25;
    heading(section.title, 24 + (firstHeight <= 600 ? firstHeight : lineHeight + rowPadding));
    tableHeader();
    if (!rows.length) {
      page.drawText("No report records for this period.", { x: margin + 7, y: y - 15, size: 10, font, color: muted });
      y -= 25;
    }
    for (const [index, cells] of rows.entries()) {
      const lines = Math.max(...cells.map(cell => cell.length));
      const rowHeight = lines * lineHeight + rowPadding;
      if (y - rowHeight < bottom && rowHeight <= 600) {
        newPage();
        heading(`${section.title} (continued)`, 24 + rowHeight);
        tableHeader();
      }
      let offset = 0;
      while (offset < lines) {
        let capacity = Math.floor((y - bottom - rowPadding) / lineHeight);
        if (capacity < 1) {
          newPage();
          heading(`${section.title} (continued)`, 48);
          tableHeader();
          capacity = Math.floor((y - bottom - rowPadding) / lineHeight);
        }
        const visible = Math.min(capacity, lines - offset);
        const height = visible * lineHeight + rowPadding;
        if (index % 2 === 0) page.drawRectangle({ x: margin, y: y - height, width, height, color: pale });
        let x = margin;
        for (const [column, cell] of cells.entries()) {
          cell.slice(offset, offset + visible).forEach((line, lineIndex) =>
            page.drawText(line, { x: x + 7, y: y - 15 - lineIndex * lineHeight, size: 9, font, color: ink }));
          x += columns[column].width;
        }
        y -= height;
        page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: 0.4, color: rule });
        offset += visible;
      }
    }
  }

  for (const section of sections) {
    if (section.records) {
      tableRows(section, section.records);
      y -= 20;
      continue;
    }
    const labels = section.rows.map(row => wrap(row.name, width - 68, 10));
    heading(section.title, (labels[0]?.length || 1) * 13 + 23);
    if (!section.rows.length) {
      page.drawText("No data for this period.", { x: margin, y: y - 10, size: 10, font, color: muted });
      y -= 24;
    }
    const largest = Math.max(1, ...section.rows.map(row => row.value));
    for (const [index, row] of section.rows.entries()) {
      const lines = labels[index];
      const height = lines.length * 13 + 23;
      if (y - height < bottom) {
        newPage();
        heading(`${section.title} (continued)`, height);
      }
      lines.forEach((line, lineIndex) => page.drawText(line, { x: margin, y: y - 10 - lineIndex * 13, size: 10, font, color: ink }));
      const value = String(row.value);
      page.drawText(value, { x: margin + width - bold.widthOfTextAtSize(value, 10), y: y - 10, size: 10, font: bold, color: ink });
      const barY = y - lines.length * 13 - 7;
      page.drawRectangle({ x: margin, y: barY, width, height: 5, color: pale });
      if (row.value > 0) page.drawRectangle({ x: margin, y: barY, width: width * row.value / largest, height: 5, color: green });
      y -= height;
    }
    y -= 12;
  }

  const remainingNotes = notes.filter(note => note !== periodNote);
  if (remainingNotes.length) {
    heading("How to read this report", 28);
    for (const note of remainingNotes) {
      for (const line of wrap(note, width, 9)) {
        ensure(13);
        page.drawText(line, { x: margin, y: y - 9, size: 9, font, color: muted });
        y -= 13;
      }
      y -= 7;
    }
  }
  pdf.getPages().forEach((sheet, index) => {
    sheet.drawLine({ start: { x: margin, y: 43 }, end: { x: margin + width, y: 43 }, thickness: 0.7, color: rule });
    sheet.drawText("TrashTrack / Municipal Environment and Natural Resources Office", { x: margin, y: 28, size: 8, font, color: muted });
    const count = `Page ${index + 1} of ${pdf.getPageCount()}`;
    sheet.drawText(count, { x: margin + width - font.widthOfTextAtSize(count, 8), y: 28, size: 8, font, color: muted });
  });
  pdf.setTitle(isRecords ? "TrashTrack Report Records" : "TrashTrack Reports and Analytics");
  return pdf.save();
}

export async function downloadAnalyticsPdf(sections: AnalyticsPdfSection[], notes: string[] = [], name = "Analytics") {
  const bytes = await buildAnalyticsPdf(sections, notes);
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type:"application/pdf" }));
  const anchor = document.createElement("a");anchor.href = url;anchor.download = `TrashTrack-${name}.pdf`;anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Open the same filtered document in the browser PDF viewer, which provides printing. */
export async function openPrintableAnalyticsPdf(sections:AnalyticsPdfSection[],notes:string[]=[]) {
  const preview=window.open("about:blank","_blank");
  if(!preview)throw new Error("Allow the PDF preview window to print selected records.");
  preview.opener=null;
  try {
    const bytes=await buildAnalyticsPdf(sections,notes);
    const url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:"application/pdf"}));
    preview.location.replace(url);
    setTimeout(()=>URL.revokeObjectURL(url),10*60*1000);
  } catch(error){preview.close();throw error;}
}
