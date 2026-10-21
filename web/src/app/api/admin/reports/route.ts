import { reportsCol } from "@/lib/db";
import { getAuthUser, hasMinRole } from "@/lib/auth";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = getAuthUser(request);
  if (!auth || !hasMinRole(auth.role, "admin")) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const status = new URL(request.url).searchParams.get("status");
    const snap = status
      ? await reportsCol.ref.where("status", "==", status).get()
      : await reportsCol.ref.get();

    const reports = snap.docs
      .map((d) => ({ ...d.data(), id: d.data().numericId }))
      .sort((a, b) =>
        String((b as { created_at?: string }).created_at).localeCompare(
          String((a as { created_at?: string }).created_at),
        ),
      );

    return Response.json({ reports });
  } catch (err) {
    console.error("Admin reports error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
