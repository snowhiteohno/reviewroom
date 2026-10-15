import { randomUUID } from "node:crypto";
import { writeFile, unlink } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { Version } from "../models/index.js";
import {
  access,
  changeProject,
  log,
  requireEditor,
} from "../services/projects.js";
import { ApiError } from "../utils/errors.js";
export function uploadController(config) {
  return {
    upload: async (req, res) => {
      const { role } = await access(req.params.id, req.user);
      requireEditor(role);
      if (!req.file) throw new ApiError(400, "Please choose a design image.");
      let metadata;
      try {
        metadata = await sharp(req.file.buffer, {
          limitInputPixels: 40000000,
        }).metadata();
      } catch {
        throw new ApiError(
          400,
          "This image could not be opened. Please try a different file.",
        );
      }
      const formats = {
          png: "image/png",
          jpeg: "image/jpeg",
          webp: "image/webp",
          gif: "image/gif",
        },
        mime = formats[metadata.format];
      if (!mime || !metadata.width || !metadata.height)
        throw new ApiError(
          400,
          "Please upload a PNG, JPG, WebP, or GIF image.",
        );
      const id = randomUUID(),
        fileKey = id + "." + metadata.format,
        filePath = path.join(config.uploadDir, fileKey);
      await writeFile(filePath, req.file.buffer, { flag: "wx", mode: 0o600 });
      try {
        await changeProject(
          req.params.id,
          req.user,
          async ({ project, role, session }) => {
            requireEditor(role);
            project.versionCounter += 1;
            project.latestVersionId = id;
            await Version.create(
              [
                {
                  _id: id,
                  projectId: project._id,
                  number: project.versionCounter,
                  fileKey,
                  fileName: req.file.originalname.slice(0, 180),
                  mime,
                  width: metadata.width,
                  height: metadata.height,
                },
              ],
              { session },
            );
            await log(
              project,
              req.user,
              "Uploaded version " + project.versionCounter,
              session,
            );
          },
        );
      } catch (error) {
        await unlink(filePath).catch(() => {});
        throw error;
      }
      res.status(201).json({ id });
    },
    asset: async (req, res) => {
      const v = await Version.findById(req.params.id);
      if (!v) throw new ApiError(404, "This file could not be found.");
      await access(v.projectId, req.user);
      if (v.fileKey.startsWith("sample:")) {
        const key = v.fileKey.slice(7);
        if (!/^[a-z0-9-]+$/.test(key))
          throw new ApiError(404, "This file could not be found.");
        return res.redirect("/samples/" + key + ".svg");
      }
      res.set({
        "Content-Type": v.mime,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      });
      if (req.query.download === "1")
        return res.download(
          path.join(config.uploadDir, v.fileKey),
          v.fileName,
          { dotfiles: "allow" },
        );
      res.sendFile(path.join(config.uploadDir, v.fileKey), {
        dotfiles: "allow",
      });
    },
  };
}
