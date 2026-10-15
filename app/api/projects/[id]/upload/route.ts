import {
  api,
  user,
  db,
  bucket,
  sameOrigin,
  uid,
  now,
  activity,
  access,
  ApiError,
} from "@/lib/server";
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return api(async () => {
    sameOrigin(req);
    const u = await user(),
      { id } = await ctx.params;
    const { role } = await access(id, u);
    if (role === "reviewer")
      throw new ApiError(403, "Only editors can upload a version.");
    if (Number(req.headers.get("content-length")) > 13 * 1024 * 1024)
      throw new ApiError(413, "Please choose an image smaller than 12 MB.");
    const form = await req.formData(),
      file = form.get("file");
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 12 * 1024 * 1024
    )
      throw new ApiError(400, "Please choose an image smaller than 12 MB.");
    const data = await file.arrayBuffer(),
      bytes = new Uint8Array(data);
    let mime = "";
    if (
      bytes[0] === 137 &&
      bytes[1] === 80 &&
      bytes[2] === 78 &&
      bytes[3] === 71
    )
      mime = "image/png";
    else if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255)
      mime = "image/jpeg";
    else if (String.fromCharCode(...bytes.slice(0, 6)).match(/^GIF8[79]a$/))
      mime = "image/gif";
    else if (
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
    )
      mime = "image/webp";
    if (!mime)
      throw new ApiError(400, "Please upload a PNG, JPG, WebP, or GIF image.");
    const versionId = uid(),
      key = `${id}/${versionId}`,
      time = now();
    await bucket().put(key, data, { httpMetadata: { contentType: mime } });
    try {
      await db().batch([
        db()
          .prepare(
            "INSERT INTO versions (id,project_id,number,file_key,file_name,mime,status,created_at) SELECT ?,?,COALESCE(MAX(number),0)+1,?,?,?,'draft',? FROM versions WHERE project_id=?",
          )
          .bind(versionId, id, key, file.name.slice(0, 180), mime, time, id),
        db()
          .prepare("UPDATE projects SET updated_at=? WHERE id=?")
          .bind(time, id),
        activity(id, u, "Uploaded a new version"),
      ]);
    } catch (e) {
      await bucket().delete(key);
      throw e;
    }
    return Response.json({ id: versionId }, { status: 201 });
  });
}
