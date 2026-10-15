import {
  api,
  user,
  db,
  projectSelect,
  sameOrigin,
  json,
  str,
  uid,
  now,
  activity,
  access,
  ApiError,
} from "@/lib/server";
type Context = { params: Promise<{ id: string }> };
export const dynamic = "force-dynamic";
export async function GET(_: Request, ctx: Context) {
  return api(async () => {
    const u = await user(),
      { id } = await ctx.params;
    const { role } = await access(id, u);
    const p = await db()
      .prepare(`${projectSelect} WHERE p.id=?`)
      .bind(u.userId, id)
      .first();
    const [versions, comments, members, logs] = await Promise.all([
      db()
        .prepare(
          "SELECT * FROM versions WHERE project_id=? ORDER BY number DESC",
        )
        .bind(id)
        .all(),
      db()
        .prepare(
          "SELECT c.* FROM comments c JOIN versions v ON c.version_id=v.id WHERE v.project_id=? ORDER BY c.created_at ASC,c.id ASC",
        )
        .bind(id)
        .all(),
      db()
        .prepare("SELECT id,email,role FROM members WHERE project_id=?")
        .bind(id)
        .all(),
      db()
        .prepare(
          "SELECT * FROM activities WHERE project_id=? ORDER BY created_at DESC LIMIT 50",
        )
        .bind(id)
        .all(),
    ]);
    return Response.json({
      project: p,
      role,
      versions: versions.results,
      comments: comments.results,
      members: members.results,
      activity: logs.results,
    });
  });
}
export async function POST(req: Request, ctx: Context) {
  return api(async () => {
    sameOrigin(req);
    const u = await user(),
      { id } = await ctx.params;
    const { role, project } = await access(id, u);
    const body = await json(req);
    const op = body.op;
    const canEdit = role === "owner" || role === "editor";
    let note = "";
    const statements: D1PreparedStatement[] = [];
    if (op === "star") {
      if (body.value === true)
        statements.push(
          db()
            .prepare(
              "INSERT OR IGNORE INTO favorites (id,project_id,user_id) VALUES (?,?,?)",
            )
            .bind(uid(), id, u.userId),
        );
      else
        statements.push(
          db()
            .prepare("DELETE FROM favorites WHERE project_id=? AND user_id=?")
            .bind(id, u.userId),
        );
    } else if (op === "archive") {
      if (role !== "owner")
        throw new ApiError(403, "Only the owner can archive a project.");
      statements.push(
        db()
          .prepare("UPDATE projects SET archived=?,updated_at=? WHERE id=?")
          .bind(body.value ? 1 : 0, now(), id),
      );
      note = body.value ? "Archived the project" : "Restored the project";
    } else if (op === "rename") {
      if (!canEdit)
        throw new ApiError(403, "Only editors can edit project details.");
      const name = str(body.name, 80, 1),
        description = str(body.description ?? "", 500);
      statements.push(
        db()
          .prepare("UPDATE projects SET name=?,description=? WHERE id=?")
          .bind(name, description, id),
      );
      note = "Updated the project details";
    } else if (op === "member" || op === "remove-member") {
      if (role !== "owner")
        throw new ApiError(403, "Only the owner can manage access.");
      const email = str(body.email, 254, 3).toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        throw new ApiError(400, "Please enter a valid email address.");
      if (email === u.email.toLowerCase())
        throw new ApiError(400, "You already own this project.");
      if (op === "member") {
        if (body.role !== "editor" && body.role !== "reviewer")
          throw new ApiError(400, "Please choose a valid role.");
        statements.push(
          db()
            .prepare(
              "INSERT INTO members (id,project_id,email,role) VALUES (?,?,?,?) ON CONFLICT(project_id,email) DO UPDATE SET role=excluded.role",
            )
            .bind(uid(), id, email, body.role),
        );
        note = `Added ${email} as ${body.role}`;
      } else {
        statements.push(
          db()
            .prepare("DELETE FROM members WHERE project_id=? AND email=?")
            .bind(id, email),
        );
        note = `Removed access for ${email}`;
      }
    } else if (op === "comment" || op === "resolve" || op === "status") {
      const versionId = str(body.versionId, 100, 1);
      const v = await db()
        .prepare("SELECT * FROM versions WHERE id=? AND project_id=?")
        .bind(versionId, id)
        .first<{ id: string; number: number; status: string }>();
      if (!v) throw new ApiError(404, "This version could not be found.");
      if (op === "comment") {
        const text = str(body.body, 3000, 1);
        let x: number | null = null,
          y: number | null = null,
          parentId: string | null = null;
        if (body.parentId) {
          parentId = str(body.parentId, 100, 1);
          if (
            !(await db()
              .prepare(
                "SELECT id FROM comments WHERE id=? AND version_id=? AND parent_id IS NULL",
              )
              .bind(parentId, versionId)
              .first())
          )
            throw new ApiError(400, "This discussion could not be found.");
        } else if (body.x != null || body.y != null) {
          if (
            typeof body.x !== "number" ||
            typeof body.y !== "number" ||
            !Number.isFinite(body.x) ||
            !Number.isFinite(body.y) ||
            body.x < 0 ||
            body.x > 1 ||
            body.y < 0 ||
            body.y > 1
          )
            throw new ApiError(
              400,
              "Please pin your comment inside the design.",
            );
          x = body.x;
          y = body.y;
        }
        statements.push(
          db()
            .prepare(
              "INSERT INTO comments (id,version_id,author_id,author_name,body,x,y,parent_id,created_at) VALUES (?,?,?,?,?,?,?,?,?)",
            )
            .bind(
              uid(),
              versionId,
              u.userId,
              u.displayName,
              text,
              x,
              y,
              parentId,
              now(),
            ),
        );
        note = `${parentId ? "Replied to feedback" : "Left feedback"} on version ${v.number}`;
      } else if (op === "resolve") {
        const c = await db()
          .prepare(
            "SELECT * FROM comments WHERE id=? AND version_id=? AND parent_id IS NULL",
          )
          .bind(str(body.commentId, 100, 1), versionId)
          .first();
        if (!c) throw new ApiError(404, "This comment could not be found.");
        if (!canEdit && c.author_id !== u.userId)
          throw new ApiError(
            403,
            "Only editors and the author can resolve this feedback.",
          );
        statements.push(
          db()
            .prepare("UPDATE comments SET resolved=? WHERE id=?")
            .bind(body.value ? 1 : 0, c.id),
        );
        note = body.value ? "Resolved a discussion" : "Reopened a discussion";
      } else {
        const status = str(body.status, 30, 1);
        if (
          !["draft", "in_review", "changes_requested", "approved"].includes(
            status,
          )
        )
          throw new ApiError(400, "Please choose a valid review status.");
        if ((status === "draft" || status === "in_review") && !canEdit)
          throw new ApiError(403, "Only editors can request a review.");
        if (
          (status === "approved" || status === "changes_requested") &&
          role === "editor"
        )
          throw new ApiError(
            403,
            "A reviewer or owner must make this decision.",
          );
        if (
          ["approved", "changes_requested"].includes(status) &&
          v.status !== "in_review"
        )
          throw new ApiError(409, "Request a review before making a decision.");
        const latest = await db()
          .prepare("SELECT MAX(number) AS n FROM versions WHERE project_id=?")
          .bind(id)
          .first<{ n: number }>();
        if (v.number !== latest?.n)
          throw new ApiError(
            409,
            "Only the latest version can change review status.",
          );
        note = `${({ draft: "Returned to draft", in_review: "Requested a review for", approved: "Approved", changes_requested: "Requested changes to" } as Record<string, string>)[status]} version ${v.number}`;
        const auditId = uid(),
          time = now();
        const result = await db().batch([
          db()
            .prepare(
              "UPDATE versions SET status=? WHERE id=? AND status=? AND number=(SELECT MAX(number) FROM versions WHERE project_id=?)",
            )
            .bind(status, versionId, v.status, id),
          db()
            .prepare(
              "INSERT INTO activities (id,project_id,actor,body,created_at) SELECT ?,?,?,?,? WHERE changes()=1",
            )
            .bind(auditId, id, u.displayName, note, time),
          db()
            .prepare(
              "UPDATE projects SET updated_at=? WHERE id=? AND EXISTS(SELECT 1 FROM activities WHERE id=?)",
            )
            .bind(time, id, auditId),
        ]);
        if (!result[0].meta.changes)
          throw new ApiError(
            409,
            "The review changed while you were working. Refresh and try again.",
          );
        return Response.json({ ok: true });
      }
    } else throw new ApiError(400, "Unknown action.");
    if (note) {
      statements.push(activity(id, u, note));
      statements.push(
        db()
          .prepare("UPDATE projects SET updated_at=? WHERE id=?")
          .bind(now(), id),
      );
    }
    await db().batch(statements);
    return Response.json({ ok: true });
  });
}
