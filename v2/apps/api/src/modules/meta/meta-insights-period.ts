import type { MetaInsightsPeriod } from "./meta.schemas.js";

export const INSTAGRAM_INSIGHTS_PERIOD_MESSAGE = "O Instagram permite importar Insights em períodos de até 30 dias. Ajuste as datas e tente novamente.";

export function assertInstagramInsightsPeriod(hasInstagram: boolean, period: MetaInsightsPeriod) {
  // Compare the actual UTC interval sent to Graph, without local-time/DST rounding.
  const duration = Date.parse(`${period.until}T00:00:00Z`) - Date.parse(`${period.since}T00:00:00Z`);
  if (hasInstagram && duration > 30 * 86_400_000) {
    throw Object.assign(new Error(INSTAGRAM_INSIGHTS_PERIOD_MESSAGE), {
      statusCode: 400,
      code: "INSTAGRAM_INSIGHTS_PERIOD_TOO_LONG",
    });
  }
}
