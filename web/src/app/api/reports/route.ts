import { ratingsCol, reportsCol, nextId } from "@/lib/db";
import { getAuthUser } from "@/lib/auth";
import { parseJsonBody } from "@/lib/validation/parse-body";
import { createReportSchema } from "@/lib/validation/schemas/reports";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = getAuthUser(request);
  if (!auth) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = await parseJsonBody(request, createReportSchema);
  if (!parsed.success) return parsed.response;

  const { target_type, target_id, reason, details } = parsed.data;

  try {
    const ratingSnap = await ratingsCol.ref
      .where("numericId", "==", target_id)
      .limit(1)
      .get();
    if (ratingSnap.empty) {
      return Response.json({ error: "Review not found" }, { status: 404 });
    }
    if (ratingSnap.docs[0].data().user_id === auth.userId) {
      return Response.json({ error: "Cannot report your own review" }, { status: 400 });
    }

    const existing = await reportsCol.ref
      .where("target_type", "==", target_type)
      .where("target_id", "==", target_id)
      .where("reporter_id", "==", auth.userId)
      .limit(1)
      .get();
    if (!existing.empty) {
      return Response.json({ error: "You already reported this review" }, { status: 409 });
    }

    const numericId = await nextId("reports");
    await reportsCol.ref.doc(String(numericId)).set({
      numericId,
      target_type,
      target_id,
      reporter_id: auth.userId,
      reason,
      details: details || null,
      status: "open",
      created_at: new Date().toISOString(),
    });

    return Response.json({ message: "Report submitted" }, { status: 201 });
  } catch (err) {
    console.error("Report error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
