import { api, user, db, bucket, access, ApiError } from "@/lib/server";
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    const u = await user(),
      { id } = await ctx.params;
    const v = await db()
      .prepare("SELECT * FROM versions WHERE id=?")
      .bind(id)
      .first<{ project_id: string; file_key: string; mime: string }>();
    if (!v) throw new ApiError(404, "This file could not be found.");
    await access(v.project_id, u);
    if (v.file_key.startsWith("sample:")) {
      const key = v.file_key.slice(7);
      if (!/^[a-z]+$/.test(key)) throw new ApiError(404, "File not found.");
      return Response.redirect(new URL(`/samples/${key}.svg`, req.url), 302);
    }
    const obj = await bucket().get(v.file_key);
    if (!obj) throw new ApiError(404, "This file could not be found.");
    return new Response(obj.body, {
      headers: {
        "Content-Type": v.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  });
}
