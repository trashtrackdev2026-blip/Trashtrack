export const OFF_TOPIC_REPLY = "I can help with waste segregation, recycling, disposal, and environmental concerns in Balete. Please ask a question about one of those topics.";

export function parseChatResponse(raw: string): string {
  const result: unknown = JSON.parse(raw);
  if (!result || typeof result !== "object" || !("inScope" in result) || !("text" in result)
      || typeof result.inScope !== "boolean" || typeof result.text !== "string") {
    throw new Error("Invalid AI response");
  }
  // Never pass an off-topic answer through, even if the model supplies one.
  if (!result.inScope) return OFF_TOPIC_REPLY;
  if (!result.text.trim()) throw new Error("Empty AI response");
  return result.text.trim();
}
