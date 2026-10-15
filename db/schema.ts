import {
  sqliteTable,
  text,
  integer,
  real,
  uniqueIndex,
  index,
} from "drizzle-orm/sqlite-core";
export const profiles = sqliteTable("profiles", {
  id: text("id").primaryKey(),
  createdAt: integer("created_at").notNull(),
});
export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    ownerId: text("owner_id").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default("Branding"),
    color: text("color").notNull().default("rose"),
    archived: integer("archived").notNull().default(0),
    sample: integer("sample").notNull().default(0),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("project_owner").on(t.ownerId)],
);
export const members = sqliteTable(
  "members",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").notNull(),
  },
  (t) => [uniqueIndex("project_member").on(t.projectId, t.email)],
);
export const favorites = sqliteTable(
  "favorites",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
  },
  (t) => [uniqueIndex("project_favorite").on(t.projectId, t.userId)],
);
export const versions = sqliteTable(
  "versions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    fileKey: text("file_key").notNull(),
    fileName: text("file_name").notNull(),
    mime: text("mime").notNull(),
    status: text("status").notNull().default("draft"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("project_version").on(t.projectId, t.number)],
);
export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    versionId: text("version_id")
      .notNull()
      .references(() => versions.id, { onDelete: "cascade" }),
    authorId: text("author_id").notNull(),
    authorName: text("author_name").notNull(),
    body: text("body").notNull(),
    x: real("x"),
    y: real("y"),
    parentId: text("parent_id"),
    resolved: integer("resolved").notNull().default(0),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("comments_version").on(t.versionId)],
);
export const activities = sqliteTable(
  "activities",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    actor: text("actor").notNull(),
    body: text("body").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("activities_project").on(t.projectId)],
);
