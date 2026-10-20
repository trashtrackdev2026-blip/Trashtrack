const TYPES = ["Recyclable", "Biodegradable", "Residual", "Special", "Not Waste"];
export const UNCERTAIN_TEXT = "ITEM: Image unclear\nTYPE: Uncertain\nCONFIDENCE: 0%\nSTEPS:\n- Move closer to one item, improve the lighting, and scan again.";

export function classificationText(raw: string): string {
  const value = JSON.parse(raw);
  if (!value || typeof value.item !== "string" || !value.item.trim()) throw new Error("Invalid classification");
  if (value.type === "Uncertain") return UNCERTAIN_TEXT;
  if (!TYPES.includes(value.type) || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 100) throw new Error("Invalid classification confidence or type");
  // Some model responses use probability (0.95) instead of percentage (95).
  const confidence = value.confidence > 0 && value.confidence < 1 ? value.confidence * 100 : value.confidence;
  if (!Array.isArray(value.steps) || !value.steps.length || value.steps.some((step: unknown) => typeof step !== "string" || !step.trim())) throw new Error("Invalid disposal steps");
  const clean = (text: string) => text.replace(/[\r\n]+/g, " ").trim().slice(0, 300);
  return `ITEM: ${clean(value.item)}\nTYPE: ${value.type}\nCONFIDENCE: ${Math.round(confidence)}%\nSTEPS:\n${value.steps.slice(0, 4).map((step: string) => "- " + clean(step)).join("\n")}`;
}
