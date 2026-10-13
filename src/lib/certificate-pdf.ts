import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import type { CertificateSnapshot } from "./certificate-data";

const WIDTH = 841.89, HEIGHT = 595.28;

function fontText(text: string, font: PDFFont) {
  const supported = new Set(font.getCharacterSet());
  return Array.from(text).map(char => supported.has(char.codePointAt(0)!) ? char : "?").join("");
}

export function wrapCertificateText(text: string, font: PDFFont, size: number, maximumWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const parts: string[] = [];
    let part = "";
    for (const character of word) {
      if (part && font.widthOfTextAtSize(part + character, size) > maximumWidth) { parts.push(part); part = ""; }
      part += character;
    }
    if (part) parts.push(part);
    for (const fragment of parts) {
      const candidate = line ? line + " " + fragment : fragment;
      if (line && font.widthOfTextAtSize(candidate, size) > maximumWidth) { lines.push(line); line = fragment; }
      else line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export async function generateCertificatePdf(snapshot: CertificateSnapshot): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const assets = join(process.cwd(), "assets", "certificates");
  const [backgroundBytes, scriptBytes] = await Promise.all([
    readFile(join(assets, "appreciation-v1.png")), readFile(join(assets, "GreatVibes-Regular.ttf")),
  ]);
  const background = await pdf.embedPng(backgroundBytes);
  const script = await pdf.embedFont(scriptBytes, { subset: true });
  const serif = await pdf.embedFont(StandardFonts.TimesRoman);
  const page = pdf.addPage([WIDTH, HEIGHT]);
  page.drawImage(background, { x: 0, y: 0, width: WIDTH, height: HEIGHT });
  const ink = rgb(0.29, 0.27, 0.22), gold = rgb(0.86, 0.68, 0.28);
  function centered(text: string, font: PDFFont, size: number, y: number, color = ink) {
    page.drawText(text, { x: (WIDTH - font.widthOfTextAtSize(text, size)) / 2, y, size, font, color });
  }
  const name = fontText(snapshot.participantName, script);
  const nameWidth = WIDTH * 0.69;
  let nameSize = 55;
  while (script.widthOfTextAtSize(name, nameSize) > nameWidth && nameSize > 30) nameSize -= 1;
  let nameLines = wrapCertificateText(name, script, nameSize, nameWidth);
  while (nameLines.length > 2 && nameSize > 10) {
    nameSize -= 1;
    nameLines = wrapCertificateText(name, script, nameSize, nameWidth);
  }
  nameLines.forEach((line, index) => centered(line, script, nameSize,
    HEIGHT * 0.559 + (nameLines.length - 1 - index) * nameSize * 0.93, gold));
  const body = fontText("in recognition of his/her active participation in the “" + snapshot.eventTitle +
    "”, organized by the " + snapshot.organizer + ". Given this " + snapshot.eventDate + ".", serif);
  let bodySize = 18, bodyLines = wrapCertificateText(body, serif, bodySize, WIDTH * 0.78);
  while (bodyLines.length > 5 && bodySize > 13) {
    bodySize -= 0.5;
    bodyLines = wrapCertificateText(body, serif, bodySize, WIDTH * 0.78);
  }
  bodyLines.forEach((line, index) => centered(line, serif, bodySize, HEIGHT * 0.418 - index * bodySize * 1.18));
  const signatory = fontText(snapshot.signatory, serif);
  let signatorySize = 17;
  while (serif.widthOfTextAtSize(signatory, signatorySize) > WIDTH * 0.56 && signatorySize > 11) signatorySize -= 0.5;
  let signatoryLines = wrapCertificateText(signatory, serif, signatorySize, WIDTH * 0.56);
  while (signatoryLines.length > 2 && signatorySize > 9) {
    signatorySize -= 0.5;
    signatoryLines = wrapCertificateText(signatory, serif, signatorySize, WIDTH * 0.56);
  }
  signatoryLines.forEach((line, index) => centered(line, serif, signatorySize, HEIGHT * 0.121 - index * signatorySize * 1.1));
  const position = fontText(snapshot.position, serif);
  let positionSize = 15;
  while (serif.widthOfTextAtSize(position, positionSize) > WIDTH * 0.56 && positionSize > 10) positionSize -= 0.5;
  wrapCertificateText(position, serif, positionSize, WIDTH * 0.56)
    .forEach((line, index) => centered(line, serif, positionSize, HEIGHT * 0.085 - index * positionSize * 1.1));
  pdf.setTitle("Certificate of Appreciation - " + snapshot.participantName);
  pdf.setAuthor(snapshot.organizer);
  pdf.setSubject(snapshot.eventTitle + " - " + snapshot.eventDate);
  return pdf.save();
}
