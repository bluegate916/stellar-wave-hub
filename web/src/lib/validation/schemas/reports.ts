import { z } from "zod";

export const REPORT_REASONS = [
  "spam",
  "abusive",
  "off_topic",
  "misleading",
  "other",
] as const;

export const createReportSchema = z.object({
  target_type: z.literal("rating"),
  target_id: z.coerce.number().int().positive("target_id is required"),
  reason: z.enum(REPORT_REASONS),
  details: z.string().max(1000).nullable().optional(),
});

export type CreateReportInput = z.infer<typeof createReportSchema>;
