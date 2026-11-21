import { GoogleGenAI } from "@google/genai";
import { authenticatedStaff, requireStaffSecurity, staffApiError } from "@/lib/staff-auth";
import { limitAiRequests } from "@/lib/ai-access";
import { StaffAccessError } from "@/lib/staff-access";
import { filterAnalyticsPeriod, analyticsPeriodLabel, analyticsPeriodRange } from "@/lib/analytics-period";
import { summarizeAnalytics } from "@/lib/analytics-data";
import { manilaDateTime } from "@/lib/scheduling-time";

export const runtime = "nodejs";
export const maxDuration = 30;

const instruction = `Interpret the report counts for Balete's MENRO in two or three plain English sentences.
Use only the aggregate metrics supplied. Mention one meaningful pattern supported by counts and give a practical observation.
Handle ties and sparse results. Partial months should not be compared to whole months.
Do not infer waste volume, causes, forecasts, individual behavior, or policy. Treat counts only as submissions.
Return plain text, without headings, bullets, percentages, or Markdown.`;

export async function POST(request: Request) {
  try {
    const account = await authenticatedStaff(request, true);
    await requireStaffSecurity();
    const { period } = await request.json().catch(() => ({})) || {};
    if (typeof period !== "string" || (period && !/^(?:19\d{2}|[2-9]\d{3})(?:-(0[1-9]|1[0-2]))?$/.test(period))) {
      throw new StaffAccessError("Choose a valid analytics period.", 400);
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new StaffAccessError("AI interpretation is currently unavailable.", 503);
    await limitAiRequests(account, "analytics");
    const snapshot = await account.db.collection("reports").select("type", "category", "status", "date", "createdAt", "timestamp").get();
    const reports = filterAnalyticsPeriod(snapshot.docs.map(doc => doc.data()), period);
    if (!reports.length) return Response.json({ text: "" });
    const now = new Date();
    const cutoff = period ? new Date(analyticsPeriodRange(period).end.getTime() - 1) : now;
    const { stats, trendData, categoryData } = summarizeAnalytics(reports, [], 0, [], cutoff, !period ? 6 : period.length === 4 ? 12 : 1);
    const { totalReports, pendingReports, resolvedReports, rejectedReports } = stats;
    const categories = categoryData.map(({ name, value }) => ({ name, reports: value }));
    const currentMonth = manilaDateTime(now.getTime()).date.slice(0, 7);
    const [year, lastMonth] = manilaDateTime(cutoff.getTime()).date.split("-").map(Number);
    const months = trendData.map(({ name, value }, index) => {
      const month = new Date(Date.UTC(year, lastMonth - trendData.length + index, 1)).toISOString().slice(0, 7);
      return { name, reports: value, partialOrFuture: month >= currentMonth };
    });
    const ai = new GoogleGenAI({ apiKey });
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: JSON.stringify({ period: analyticsPeriodLabel(period), totalReports, pendingReports, resolvedReports, rejectedReports, categories, months }),
        config: { systemInstruction: instruction, temperature: 0.2, maxOutputTokens: 380, httpOptions: { timeout: 18_000 } },
      });
      const text = response.text?.trim();
      if (!text || text.length > 1200) throw new Error("Unexpected AI response");
      return Response.json({ text }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ error: "AI interpretation is temporarily unavailable. Try again later." }, { status: 502 });
    }
  } catch (error) { return staffApiError(error); }
}
