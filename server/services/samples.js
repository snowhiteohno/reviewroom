import mongoose from "mongoose";
import {
  User,
  Project,
  Version,
  Comment,
  Activity,
  Poll,
} from "../models/index.js";
const samples = [
  [
    "flora",
    "Flora studio",
    "A fresh identity for a neighborhood flower shop.",
    "Branding",
    "rose",
    "in_review",
  ],
  [
    "sunday",
    "Sunday coffee",
    "Packaging and a little warmth for your daily ritual.",
    "Packaging",
    "sage",
    "changes_requested",
  ],
  [
    "muse",
    "Muse journal",
    "An editorial direction for a slower kind of magazine.",
    "Editorial",
    "lavender",
    "approved",
  ],
  [
    "peach",
    "Peach & cream",
    "A playful identity for a small skincare collection.",
    "Branding",
    "peach",
    "draft",
  ],
  [
    "olive",
    "Olive house",
    "A thoughtful website for a homeware collection.",
    "Web design",
    "sage",
    "in_review",
  ],
  [
    "petal",
    "Petal notes",
    "Paper goods for the things worth remembering.",
    "Packaging",
    "yellow",
    "draft",
  ],
];
export async function initializeStudio(user) {
  await mongoose.connection.transaction(async (session) => {
    const claimed = await User.findOneAndUpdate(
      { _id: user._id, studioInitialized: false },
      { $set: { studioInitialized: true } },
      { session, new: true },
    );
    if (!claimed) return;
    for (const [
      i,
      [key, name, description, category, color, status],
    ] of samples.entries()) {
      const time = new Date(Date.now() - i * 7200000);
      const [project] = await Project.create(
        [
          {
            ownerId: user._id,
            name,
            description,
            category,
            color,
            sample: true,
            createdAt: time,
            updatedAt: time,
          },
        ],
        { session },
      );
      const [version] = await Version.create(
        [
          {
            projectId: project._id,
            number: 1,
            fileKey: "sample:" + key,
            fileName: key + "-concept.svg",
            mime: "image/svg+xml",
            width: 1200,
            height: 900,
            status: key === "flora" ? "changes_requested" : status,
            createdAt: time,
            updatedAt: time,
          },
        ],
        { session },
      );
      project.versionCounter = 1;
      project.latestVersionId = version._id;
      if (key === "flora") {
        const [next] = await Version.create(
          [
            {
              projectId: project._id,
              number: 2,
              fileKey: "sample:flora-v2",
              fileName: "flora-revision.svg",
              mime: "image/svg+xml",
              width: 1200,
              height: 900,
              status: "in_review",
              createdAt: time,
              updatedAt: time,
            },
          ],
          { session },
        );
        project.versionCounter = 2;
        project.latestVersionId = next._id;
        await Comment.create(
          [
            {
              projectId: project._id,
              versionId: version._id,
              authorId: "sample-maya",
              authorName: "Maya (sample)",
              body: "Could we make the flower a little larger? The softer colors feel right.",
              x: 0.62,
              y: 0.38,
              kind: "must_fix",
              resolution: "addressed",
              addressedVersionId: next._id,
              addressedBy: "sample-designer",
            },
          ],
          { session },
        );
        await Poll.create(
          [
            {
              projectId: project._id,
              creatorId: user._id,
              question: "Which direction feels right for Flora?",
              versionIds: [version._id, next._id],
            },
          ],
          { session },
        );
      } else if (key === "sunday" || key === "olive") {
        await Comment.create(
          [
            {
              projectId: project._id,
              versionId: version._id,
              authorId: "sample-maya",
              authorName: "Maya (sample)",
              body:
                key === "sunday"
                  ? "Can we try a darker green for the small text?"
                  : "Could we give the headline a little more space?",
              x: 0.5,
              y: 0.55,
            },
          ],
          { session },
        );
      }
      await project.save({ session, timestamps: false });
      await Activity.create(
        [
          {
            projectId: project._id,
            actor: "Sample studio",
            body: "Created this sample project",
            createdAt: time,
            updatedAt: time,
          },
        ],
        { session },
      );
    }
  });
}
