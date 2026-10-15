import mongoose from "mongoose";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import { ApiError } from "../utils/errors.js";
function bucket() {
  return new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
    bucketName: "designs",
  });
}
function fileId(key) {
  const value = key.slice("gridfs:".length);
  if (!/^[a-f0-9]{24}$/.test(value))
    throw new ApiError(404, "This file could not be found.");
  return new mongoose.mongo.ObjectId(value);
}
function diskPath(config, key) {
  if (!/^[a-f0-9-]{36}\.(png|jpeg|webp|gif)$/.test(key))
    throw new ApiError(404, "This file could not be found.");
  return path.join(config.uploadDir, key);
}
export async function saveAsset(config, { id, format, buffer, mime }) {
  const name = id + "." + format;
  if (config.uploadStorage === "gridfs") {
    const stream = bucket().openUploadStream(name, {
      metadata: { versionId: id, mime },
    });
    try {
      await pipeline(Readable.from(buffer), stream);
    } catch (error) {
      await stream.abort().catch(() => {});
      throw error;
    }
    return "gridfs:" + stream.id.toString();
  }
  await writeFile(diskPath(config, name), buffer, { flag: "wx", mode: 0o600 });
  return name;
}
export async function deleteAsset(config, key) {
  if (key.startsWith("gridfs:")) return bucket().delete(fileId(key));
  return unlink(diskPath(config, key));
}
export async function sendAsset(config, version, req, res) {
  res.set({
    "Content-Type": version.mime,
    "Cache-Control": "private, no-store",
    "X-Content-Type-Options": "nosniff",
  });
  if (version.fileKey.startsWith("gridfs:")) {
    const store = bucket(),
      id = fileId(version.fileKey),
      file = await store.find({ _id: id }).next();
    if (!file) throw new ApiError(404, "This file could not be found.");
    if (req.query.download === "1") {
      res.attachment(version.fileName);
      res.type(version.mime);
    }
    res.set("Content-Length", String(file.length));
    try {
      await pipeline(store.openDownloadStream(id), res);
    } catch (error) {
      if (["ERR_STREAM_PREMATURE_CLOSE", "ECONNRESET"].includes(error.code))
        return;
      throw error;
    }
    return;
  }
  const file = diskPath(config, version.fileKey);
  if (req.query.download === "1")
    return res.download(file, version.fileName, { dotfiles: "allow" });
  return res.sendFile(file, { dotfiles: "allow" });
}
