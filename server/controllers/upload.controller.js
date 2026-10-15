import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { saveAsset, deleteAsset, sendAsset } from "../services/assets.js";
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
      const id = randomUUID();
      const fileKey = await saveAsset(config, {
        id,
        format: metadata.format,
        buffer: req.file.buffer,
        mime,
      });
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
        await deleteAsset(config, fileKey).catch(() => {});
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
      await sendAsset(config, v, req, res);
    },
  };
}
