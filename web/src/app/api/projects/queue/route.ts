import { projectsCol, usersCol } from "@/lib/db";
export const dynamic = "force-dynamic";

async function getUsername(uid: number, cache: Map<number, string>) {
  if (!uid) return null;
  if (!cache.has(uid)) {
    const uDoc = await usersCol.ref.doc(String(uid)).get();
    cache.set(uid, uDoc.exists ? (uDoc.data()!.username as string) : "unknown");
  }
  return cache.get(uid) ?? null;
}

export async function GET() {
  try {
    const snap = await projectsCol.ref
      .where("status", "==", "submitted")
      .get();

    const userCache = new Map<number, string>();
    const projects = await Promise.all(
      snap.docs.map(async (d) => {
        const p = d.data();
        const uid = p.user_id as number;
        const username = await getUsername(uid, userCache);
        const claimedBy = (p.claimed_by as number) || null;
        const claimerUsername = claimedBy ? await getUsername(claimedBy, userCache) : null;
        return {
          id: p.numericId,
          name: p.name,
          slug: p.slug,
          description: p.description,
          category: p.category,
          stellar_network: p.stellar_network || "mainnet",
          github_url: p.github_url,
          github_repos: p.github_repos || [],
          username,
          created_at: p.created_at,
          claimed_by: claimedBy,
          claimed_by_username: claimerUsername,
          claimed_at: p.claimed_at || null,
        };
      }),
    );

    projects.sort(
      (a, b) => ((b.created_at as string) > (a.created_at as string) ? 1 : -1),
    );

    return Response.json({ projects, total: projects.length });
  } catch (err) {
    console.error("Queue error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { projectId, action, userId } = body as {
      projectId?: number;
      action?: "claim" | "release";
      userId?: number;
    };

    if (!projectId || !action || !userId) {
      return Response.json({ error: "Missing fields" }, { status: 400 });
    }

    // Verify maintainer
    const uDoc = await usersCol.ref.doc(String(userId)).get();
    if (!uDoc.exists) {
      return Response.json({ error: "Unauthorized" }, { status: 403 });
    }
    const user = uDoc.data()!;
    const isMaintainer = user.is_maintainer === true || user.role === "maintainer" || user.role === "admin";
    if (!isMaintainer) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    // Find project by numericId
    const snap = await projectsCol.ref
      .where("numericId", "==", projectId)
      .limit(1)
      .get();
    if (snap.empty) {
      return Response.json({ error: "Project not found" }, { status: 404 });
    }
    const doc = snap.docs[0];
    const p = doc.data();

    if (action === "claim") {
      if (p.claimed_by && p.claimed_by !== userId) {
        return Response.json({ error: "Already claimed" }, { status: 409 });
      }
      await doc.ref.update({
        claimed_by: userId,
        claimed_at: new Date().toISOString(),
      });
    } else {
      if (p.claimed_by && p.claimed_by !== userId) {
        return Response.json({ error: "Claimed by another user" }, { status: 409 });
      }
      await doc.ref.update({
        claimed_by: null,
        claimed_at: null,
      });
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error("Queue action error:", err);
    return Response.json({ error: "Internal server error" }, { status: 500 });
  }
}
