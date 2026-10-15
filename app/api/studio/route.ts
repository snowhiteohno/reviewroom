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
  ApiError,
} from "@/lib/server";
import { initialize } from "@/lib/samples";
export const dynamic = "force-dynamic";
export async function GET() {
  return api(async () => {
    const u = await user();
    const projects = await db()
      .prepare(
        `${projectSelect} WHERE p.owner_id=? OR EXISTS(SELECT 1 FROM members m WHERE m.project_id=p.id AND m.email=?) ORDER BY p.updated_at DESC`,
      )
      .bind(u.userId, u.userId, u.email.toLowerCase())
      .all();
    const logs = await db()
      .prepare(
        "SELECT a.*, p.name AS project_name FROM activities a JOIN projects p ON a.project_id=p.id WHERE p.owner_id=? OR EXISTS(SELECT 1 FROM members m WHERE m.project_id=p.id AND m.email=?) ORDER BY a.created_at DESC LIMIT 60",
      )
      .bind(u.userId, u.email.toLowerCase())
      .all();
    return Response.json({
      user: u,
      projects: projects.results,
      activity: logs.results,
    });
  });
}
export async function POST(req: Request) {
  return api(async () => {
    sameOrigin(req);
    const u = await user();
    const body = await json(req);
    if (body.op === "initialize") {
      await initialize(u);
      return Response.json({ ok: true });
    }
    if (body.op !== "create") throw new ApiError(400, "Unknown action.");
    const name = str(body.name, 80, 1),
      description = str(body.description ?? "", 500),
      category = str(body.category ?? "Branding", 30, 1),
      color = str(body.color ?? "rose", 20, 1);
    if (!["rose", "sage", "lavender", "peach", "yellow"].includes(color))
      throw new ApiError(400, "Please choose a project color.");
    const id = uid(),
      time = now();
    await db().batch([
      db()
        .prepare(
          "INSERT INTO projects (id,owner_id,name,description,category,color,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)",
        )
        .bind(id, u.userId, name, description, category, color, time, time),
      activity(id, u, "Created the project"),
    ]);
    return Response.json({ id }, { status: 201 });
  });
}
