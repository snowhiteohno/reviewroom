import { env } from "cloudflare:workers";
import { getChatGPTUser } from "@/app/chatgpt-auth";
import type { User } from "./types";
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function db() {
  if (!env.DB) throw new Error("Database is unavailable");
  return env.DB;
}
export function bucket() {
  if (!env.BUCKET) throw new Error("File storage is unavailable");
  return env.BUCKET;
}
export const uid = () => crypto.randomUUID();
export const now = () => Date.now();
export async function user() {
  const u = await getChatGPTUser();
  if (!u) throw new ApiError(401, "Please sign in to continue.");
  return u;
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new ApiError(403, "This request is not allowed.");
}
export async function json(request: Request) {
  if (Number(request.headers.get("content-length")) > 30000)
    throw new ApiError(413, "This request is too large.");
  try {
    const value: unknown = await request.json();
    if (!value || typeof value !== "object" || Array.isArray(value))
      throw new Error("Expected an object");
    return value as Record<string, unknown>;
  } catch {
    throw new ApiError(400, "Please check the submitted information.");
  }
}
export function str(value: unknown, max: number, min = 0) {
  if (
    typeof value !== "string" ||
    value.trim().length < min ||
    value.trim().length > max
  )
    throw new ApiError(
      400,
      `Please enter between ${min} and ${max} characters.`,
    );
  return value.trim();
}
export async function access(id: string, u: User) {
  const p = await db()
    .prepare("SELECT * FROM projects WHERE id=?")
    .bind(id)
    .first<Record<string, unknown>>();
  if (!p) throw new ApiError(404, "This project could not be found.");
  if (p.owner_id === u.userId) return { project: p, role: "owner" as const };
  const m = await db()
    .prepare("SELECT role FROM members WHERE project_id=? AND email=?")
    .bind(id, u.email.toLowerCase())
    .first<{ role: "editor" | "reviewer" }>();
  if (!m) throw new ApiError(403, "You do not have access to this project.");
  return { project: p, role: m.role };
}
export function activity(projectId: string, u: User, body: string) {
  return db()
    .prepare(
      "INSERT INTO activities (id,project_id,actor,body,created_at) VALUES (?,?,?,?,?)",
    )
    .bind(uid(), projectId, u.displayName, body, now());
}
export const projectSelect = `SELECT p.*, (SELECT id FROM versions WHERE project_id=p.id ORDER BY number DESC LIMIT 1) AS cover, COALESCE((SELECT status FROM versions WHERE project_id=p.id ORDER BY number DESC LIMIT 1),'draft') AS status, (SELECT COUNT(*) FROM versions WHERE project_id=p.id) AS version_count, (SELECT COUNT(*) FROM comments c JOIN versions v ON c.version_id=v.id WHERE v.project_id=p.id AND v.number=(SELECT MAX(number) FROM versions WHERE project_id=p.id) AND c.parent_id IS NULL AND c.resolved=0) AS open_comments, EXISTS(SELECT 1 FROM favorites f WHERE f.project_id=p.id AND f.user_id=?) AS starred, (SELECT COUNT(*)+1 FROM members WHERE project_id=p.id) AS member_count FROM projects p`;
export async function api(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ApiError)
      return Response.json({ error: e.message }, { status: e.status });
    console.error(e);
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
