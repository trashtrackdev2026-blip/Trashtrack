const TYPES = ["Recyclable", "Biodegradable", "Residual", "Special"];
export const NOT_WASTE_TEXT = "ITEM: No waste item detected\nTYPE: Not Waste\nCONFIDENCE: 0%\nSTEPS:\n- Point the camera at a discarded item. People and living animals are not waste.";

export function classificationText(raw: string): string {
  const value = JSON.parse(raw);
  if (!value || typeof value.isWaste !== "boolean" || typeof value.item !== "string" || typeof value.subject !== "string") throw new Error("Invalid classification");
  if (!value.isWaste || value.subject !== "discarded_object"
      || /\b(person|people|human|man|woman|child|baby|boy|girl|tao|bata|lalaki|babae)\b/i.test(value.item)) return NOT_WASTE_TEXT;
  if (!TYPES.includes(value.type) || !Number.isFinite(value.confidence) || value.confidence < 70) return NOT_WASTE_TEXT;
  if (!Array.isArray(value.steps) || !value.steps.length || value.steps.some((step: unknown) => typeof step !== "string" || !step.trim())) throw new Error("Invalid disposal steps");
  const clean = (text: string) => text.replace(/[\r\n]+/g, " ").trim().slice(0, 300);
  return `ITEM: ${clean(value.item)}\nTYPE: ${value.type}\nCONFIDENCE: ${Math.min(100, Math.round(value.confidence))}%\nSTEPS:\n${value.steps.slice(0, 4).map((step: string) => "- " + clean(step)).join("\n")}`;
}
