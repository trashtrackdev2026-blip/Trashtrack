import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, PageSizes } from "pdf-lib";

export async function generateAttendanceQrPdf(event: Record<string, unknown>, payload: string) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage(PageSizes.A4);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const width = page.getWidth();
  const safe = (text: string) => [...text].map(char => {
    try { font.encodeText(char); return char; } catch { return "?"; }
  }).join("");
  const center = (text: string, y: number, size: number, strong = false) => {
    const selected = strong ? bold : font;
    const value = safe(text);
    page.drawText(value, { x: (width - selected.widthOfTextAtSize(value, size)) / 2, y, size, font: selected });
  };
  center("TrashTrack", 785, 28, true);
  center("EVENT ATTENDANCE QR", 750, 17, true);
  const title = safe(String(event.title || "Community event"));
  const lines: string[] = [];
  let line = "";
  for (const char of title) {
    if (bold.widthOfTextAtSize(line + char, 17) > width - 90) { lines.push(line); line = ""; }
    line += char;
  }
  if (line) lines.push(line);
  lines.forEach((text, index) => center(text, 711 - index * 22, 17, true));
  const date = safe(String(event.date || ""));
  let dateSize = 13;
  while (font.widthOfTextAtSize(date, dateSize) > width - 90 && dateSize > 8) dateSize--;
  center(date, 622, dateSize);
  // Vector modules stay sharp when printed. Preserve the four-module white quiet zone.
  const code = QRCode.create(payload, { errorCorrectionLevel: "M" });
  const quiet = 4;
  const side = 340;
  const moduleSize = side / (code.modules.size + quiet * 2);
  const left = (width - side) / 2;
  const bottom = 245;
  page.drawRectangle({ x: left, y: bottom, width: side, height: side, color: rgb(1, 1, 1) });
  for (let row = 0; row < code.modules.size; row++) for (let col = 0; col < code.modules.size; col++) {
    if (code.modules.get(row, col)) page.drawRectangle({
      x: left + (col + quiet) * moduleSize,
      y: bottom + side - (row + quiet + 1) * moduleSize,
      width: moduleSize, height: moduleSize, color: rgb(0, 0, 0),
    });
  }
  center("1. Register for this event in TrashTrack.", 194, 14);
  center("2. Open Events and tap Scan attendance QR.", 168, 14);
  center("3. Scan this code to confirm your attendance.", 142, 14);
  center("Your certificate is available once the event is completed.", 97, 12);
  center("Print on A4 paper at actual size.", 68, 11);
  pdf.setTitle("TrashTrack attendance QR - " + title);
  return pdf.save();
}
