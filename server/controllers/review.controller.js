import { z } from "zod";
import { Version, Comment } from "../models/index.js";
import { parse, ApiError } from "../utils/errors.js";
import { changeProject, log, requireEditor } from "../services/projects.js";
const statuses = ["draft", "in_review", "changes_requested", "approved"];
export async function changeReview(req, res) {
  const data = parse(
    z.object({
      versionId: z.string().uuid(),
      status: z.enum(statuses),
      expectedStatus: z.enum(statuses).optional(),
    }),
    req.body,
  );
  await changeProject(
    req.params.id,
    req.user,
    async ({ project, role, session }) => {
      const v = await Version.findOne({
        _id: data.versionId,
        projectId: project._id,
      }).session(session);
      if (!v) throw new ApiError(404, "This version could not be found.");
      if (v._id !== project.latestVersionId)
        throw new ApiError(
          409,
          "Only the latest version can change review status.",
        );
      if (data.expectedStatus && data.expectedStatus !== v.status)
        throw new ApiError(
          409,
          "The review changed. Refresh before making a decision.",
        );
      if (data.status === v.status)
        throw new ApiError(409, "This version already has that review status.");
      if (data.status === "approved" || data.status === "changes_requested") {
        if (role === "editor")
          throw new ApiError(
            403,
            "A reviewer or owner must make this decision.",
          );
        if (v.status !== "in_review")
          throw new ApiError(409, "Request a review before making a decision.");
        if (data.status === "approved") {
          const blockers = await Comment.countDocuments({
            projectId: project._id,
            parentId: null,
            kind: "must_fix",
            resolution: { $ne: "verified" },
          }).session(session);
          if (blockers)
            throw new ApiError(
              409,
              "Verify all " +
                blockers +
                " must fix " +
                (blockers === 1 ? "item" : "items") +
                " before approving.",
            );
        }
      } else {
        requireEditor(role);
        if (
          data.status === "in_review" &&
          !["draft", "changes_requested"].includes(v.status)
        )
          throw new ApiError(
            409,
            "Reopen this version as a draft before requesting another review.",
          );
      }
      v.status = data.status;
      await v.save({ session });
      const verbs = {
        draft: "Reopened",
        in_review: "Requested a review for",
        changes_requested: "Requested changes to",
        approved: "Approved",
      };
      await log(
        project,
        req.user,
        verbs[data.status] + " version " + v.number,
        session,
      );
    },
  );
  res.json({ ok: true });
}
