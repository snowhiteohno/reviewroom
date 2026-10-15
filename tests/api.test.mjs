import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import supertest from "supertest";
import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { createApp } from "../server/app.js";
import { connectDatabase } from "../server/config/database.js";
import {
  User,
  Project,
  Version,
  Comment,
  Vote,
} from "../server/models/index.js";
import { startLocalMongo } from "../scripts/mongo.mjs";
const suffix = randomUUID().replaceAll("-", ""),
  dbName = "reviewroom_test_" + suffix;
const uri =
  process.env.TEST_MONGODB_URI ||
  "mongodb://127.0.0.1:27019/" + dbName + "?replicaSet=reviewroom-dev";
let app,
  uploads,
  mongo,
  owner,
  editor,
  reviewer,
  stranger,
  id,
  v1,
  v2,
  blocker,
  poll;
const password = "A thoughtful test password " + suffix;
const actor = (label) => ({
  displayName: label,
  email: label.toLowerCase() + "-" + suffix + "@reviewroom.test",
  password,
});
async function register(data) {
  const agent = supertest.agent(app);
  const res = await agent.post("/api/auth/register").send(data).expect(201);
  return {
    agent,
    user: res.body.user,
    data,
    cookie: res.headers["set-cookie"][0],
  };
}
before(async () => {
  if (!process.env.TEST_MONGODB_URI) mongo = await startLocalMongo();
  await connectDatabase(uri);
  assert.match(mongoose.connection.name, /^reviewroom_test_[a-z0-9]+$/);
  await mkdir(".data/test-uploads", { recursive: true });
  uploads = await mkdtemp(path.resolve(".data/test-uploads/run-"));
  app = createApp({
    secret: "test-only-secret-" + suffix + suffix,
    production: false,
    origins: new Set(["http://localhost:5174"]),
    uploadDir: uploads,
  });
  owner = await register(actor("Mallika"));
  editor = await register(actor("Editor"));
  reviewer = await register(actor("Reviewer"));
  stranger = await register(actor("Stranger"));
});
after(async () => {
  if (mongoose.connection.readyState === 1) {
    assert.match(mongoose.connection.name, /^reviewroom_test_[a-z0-9]+$/);
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (uploads) await rm(uploads, { recursive: true, force: true });
  mongo?.kill("SIGTERM");
});
test("authentication uses hashed passwords, private cookies, and revocable sessions", async () => {
  assert.match(owner.cookie, /HttpOnly/i);
  assert.match(owner.cookie, /SameSite=Lax/i);
  const stored = await User.findById(owner.user.userId).select("+passwordHash");
  assert.notEqual(stored.passwordHash, password);
  assert.match(stored.passwordHash, /^\$2[aby]\$/);
  assert.equal("passwordHash" in owner.user, false);
  await supertest(app).get("/api/auth/me").expect(401);
  await supertest(app)
    .get("/api/studio")
    .set("oai-authenticated-user-id", owner.user.userId)
    .set("oai-authenticated-user-email", owner.user.email)
    .expect(401);
  await supertest(app)
    .post("/api/auth/login")
    .send({ email: owner.data.email, password: "wrong" })
    .expect(401);
  await supertest(app)
    .post("/api/auth/register")
    .send({ ...owner.data, email: "bad" })
    .expect(400);
  await supertest(app)
    .post("/api/auth/register")
    .send({ ...owner.data, password: "short" })
    .expect(400);
  const login = supertest.agent(app);
  const signed = await login
    .post("/api/auth/login")
    .send({ email: owner.data.email.toUpperCase(), password })
    .expect(200);
  const cookie = signed.headers["set-cookie"][0].split(";")[0];
  await login.post("/api/auth/logout").send({}).expect(200);
  await supertest(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
  await owner.agent.get("/api/auth/me").expect(200);
});
test("project permissions, input validation, and membership are checked on the server", async () => {
  const created = await owner.agent
    .post("/api/projects")
    .send({ name: "A new identity", category: "Branding", color: "rose" })
    .expect(201);
  id = created.body.id;
  await owner.agent
    .patch("/api/projects/" + id)
    .set("Origin", "https://untrusted.invalid")
    .send({ name: "No" })
    .expect(403);
  await owner.agent
    .post("/api/projects")
    .set("Content-Type", "application/json")
    .send("null")
    .expect(400);
  await stranger.agent.get("/api/projects/" + id).expect(403);
  assert.equal(
    (await stranger.agent.get("/api/studio")).body.projects.length,
    0,
  );
  await owner.agent
    .post("/api/projects/" + id + "/members")
    .send({ email: reviewer.data.email.toUpperCase(), role: "reviewer" })
    .expect(200);
  await owner.agent
    .post("/api/projects/" + id + "/members")
    .send({ email: editor.data.email, role: "editor" })
    .expect(200);
  await editor.agent
    .post("/api/projects/" + id + "/members")
    .send({ email: stranger.data.email, role: "editor" })
    .expect(403);
  await reviewer.agent
    .patch("/api/projects/" + id)
    .send({ name: "No" })
    .expect(403);
  await editor.agent
    .patch("/api/projects/" + id)
    .send({ op: "archive", value: true })
    .expect(403);
  assert.equal(
    (await reviewer.agent.get("/api/studio")).body.projects[0].id,
    id,
  );
  await reviewer.agent
    .put("/api/projects/" + id + "/favorite")
    .send({ value: true })
    .expect(200);
  assert.equal(
    (await reviewer.agent.get("/api/projects/" + id)).body.project.starred,
    1,
  );
  assert.equal(
    (await owner.agent.get("/api/projects/" + id)).body.project.starred,
    0,
  );
});
test("uploads are real images, private, and numbered safely under concurrent requests", async () => {
  const png = await sharp({
    create: { width: 240, height: 180, channels: 3, background: "#d5a7ad" },
  })
    .png()
    .toBuffer();
  const upload = (agent) =>
    agent
      .post("/api/projects/" + id + "/upload")
      .attach("file", png, "design.png");
  await upload(reviewer.agent).expect(403);
  await owner.agent
    .post("/api/projects/" + id + "/upload")
    .attach("file", Buffer.from("<svg></svg>"), "fake.png")
    .expect(400);
  const result = await upload(owner.agent).expect(201);
  v1 = result.body.id;
  const concurrent = await Promise.all([
    upload(editor.agent),
    upload(editor.agent),
  ]);
  assert.deepEqual(
    concurrent.map((r) => r.status),
    [201, 201],
  );
  const detail = (await owner.agent.get("/api/projects/" + id)).body;
  assert.deepEqual(
    detail.versions.map((v) => v.number),
    [3, 2, 1],
  );
  v2 = detail.versions[0].id;
  await supertest(app)
    .get("/api/assets/" + v1)
    .expect(401);
  await stranger.agent.get("/api/assets/" + v1).expect(403);
  const asset = await reviewer.agent.get("/api/assets/" + v1).expect(200);
  assert.match(asset.headers["cache-control"], /private/);
  assert.equal(asset.headers["content-type"], "image/png");
  assert.equal((await Version.findById(v2)).width, 240);
});
test("pinned feedback supports replies and keeps conversations on their original version", async () => {
  await reviewer.agent
    .post("/api/projects/" + id + "/comments")
    .send({ versionId: v1, body: "Outside", x: 2, y: 0.4 })
    .expect(400);
  await reviewer.agent
    .post("/api/projects/" + id + "/comments")
    .send({
      versionId: v1,
      body: "Increase the title spacing",
      x: 0.3,
      y: 0.55,
      kind: "must_fix",
    })
    .expect(201);
  let detail = (await owner.agent.get("/api/projects/" + id)).body;
  blocker = detail.comments.find((c) => c.kind === "must_fix").id;
  await editor.agent
    .post("/api/projects/" + id + "/comments")
    .send({ versionId: v1, parentId: blocker, body: "I will revise this." })
    .expect(201);
  await editor.agent
    .post("/api/projects/" + id + "/comments")
    .send({ versionId: v2, parentId: blocker, body: "Wrong version" })
    .expect(400);
  detail = (await owner.agent.get("/api/projects/" + id)).body;
  assert.equal(detail.comments.filter((c) => c.version_id === v2).length, 0);
  assert.equal(detail.comments.find((c) => c.id === blocker).x, 0.3);
  await owner.agent
    .patch("/api/projects/" + id + "/comments/" + blocker)
    .send({ action: "resolve" })
    .expect(409);
});
test("must fix feedback needs a later revision, an independent reviewer, and verification before approval", async () => {
  const comments = "/api/projects/" + id + "/comments/" + blocker,
    review = "/api/projects/" + id + "/review";
  await reviewer.agent
    .post(review)
    .send({ versionId: v2, status: "in_review" })
    .expect(403);
  await editor.agent
    .post(review)
    .send({ versionId: v2, status: "in_review" })
    .expect(200);
  await reviewer.agent
    .post(review)
    .send({ versionId: v2, status: "approved" })
    .expect(409);
  await reviewer.agent.patch(comments).send({ action: "verify" }).expect(409);
  await reviewer.agent
    .patch(comments)
    .send({ action: "address", versionId: v2 })
    .expect(403);
  await editor.agent
    .patch(comments)
    .send({ action: "address", versionId: v1 })
    .expect(400);
  await editor.agent
    .patch(comments)
    .send({ action: "address", versionId: v2 })
    .expect(200);
  await editor.agent.patch(comments).send({ action: "verify" }).expect(403);
  await reviewer.agent.patch(comments).send({ action: "verify" }).expect(200);
  const fixed = (await owner.agent.get("/api/projects/" + id)).body;
  assert.equal(fixed.blockers.length, 0);
  assert.equal(
    fixed.comments.find((c) => c.id === blocker).addressed_version_id,
    v2,
  );
  await editor.agent
    .post(review)
    .send({ versionId: v2, status: "approved" })
    .expect(403);
  await reviewer.agent
    .post(review)
    .send({ versionId: v2, status: "approved" })
    .expect(200);
  await owner.agent.patch(comments).send({ action: "reopen" }).expect(409);
  await reviewer.agent
    .post("/api/projects/" + id + "/comments")
    .send({ versionId: v1, kind: "must_fix", body: "New blocker" })
    .expect(409);
  await owner.agent
    .post(review)
    .send({ versionId: v1, status: "in_review" })
    .expect(409);
});
test("concurrent review decisions record one winner and preserve the activity trail", async () => {
  const url = "/api/projects/" + id + "/review";
  await owner.agent
    .post(url)
    .send({ versionId: v2, status: "draft" })
    .expect(200);
  await owner.agent
    .post(url)
    .send({ versionId: v2, status: "in_review" })
    .expect(200);
  const before = (await owner.agent.get("/api/projects/" + id)).body.activity
    .length;
  const results = await Promise.all([
    reviewer.agent
      .post(url)
      .send({ versionId: v2, status: "approved", expectedStatus: "in_review" }),
    owner.agent.post(url).send({
      versionId: v2,
      status: "changes_requested",
      expectedStatus: "in_review",
    }),
  ]);
  assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
  const detail = (await owner.agent.get("/api/projects/" + id)).body;
  assert.equal(detail.activity.length, before + 1);
});
test("blind voting hides counts, enforces one vote, and reveals closed results to nonvoters", async () => {
  const base = "/api/projects/" + id;
  const created = await owner.agent
    .post(base + "/polls")
    .send({ question: "Which direction feels right?", versionIds: [v1, v2] })
    .expect(201);
  poll = created.body.id;
  let p = (await reviewer.agent.get(base)).body.polls[0];
  assert.equal(p.counts, null);
  assert.equal(p.total, null);
  assert.equal(p.my_vote, null);
  await reviewer.agent
    .post(base + "/polls")
    .send({ question: "No", versionIds: [v1, v2] })
    .expect(403);
  await stranger.agent
    .post(base + "/polls/" + poll + "/votes")
    .send({ versionId: v1 })
    .expect(403);
  const votes = await Promise.all([
    reviewer.agent
      .post(base + "/polls/" + poll + "/votes")
      .send({ versionId: v1 }),
    reviewer.agent
      .post(base + "/polls/" + poll + "/votes")
      .send({ versionId: v2 }),
  ]);
  assert.deepEqual(votes.map((r) => r.status).sort(), [201, 409]);
  assert.equal(await Vote.countDocuments({ pollId: poll }), 1);
  p = (await reviewer.agent.get(base)).body.polls[0];
  assert.equal(p.total, 1);
  assert.ok(p.counts);
  assert.equal(
    (await editor.agent.get(base)).body.polls[0].counts,
    null,
    "Editors cannot bypass blind results",
  );
  await reviewer.agent
    .patch(base + "/polls/" + poll + "/close")
    .send({})
    .expect(403);
  await owner.agent
    .patch(base + "/polls/" + poll + "/close")
    .send({})
    .expect(200);
  p = (await editor.agent.get(base)).body.polls[0];
  assert.ok(p.counts);
  assert.equal(p.total, 1);
  assert.equal(p.my_vote, null);
  await editor.agent
    .post(base + "/polls/" + poll + "/votes")
    .send({ versionId: v1 })
    .expect(409);
});
test("a vote cannot include designs from another project", async () => {
  const other = (
    await owner.agent.post("/api/projects").send({ name: "Other project" })
  ).body.id;
  const png = await sharp({
    create: { width: 10, height: 10, channels: 3, background: "#ddd" },
  })
    .png()
    .toBuffer();
  const otherVersion = (
    await owner.agent
      .post("/api/projects/" + other + "/upload")
      .attach("file", png, "other.png")
  ).body.id;
  await owner.agent
    .post("/api/projects/" + id + "/polls")
    .send({ question: "Invalid options", versionIds: [v1, otherVersion] })
    .expect(400);
});
test("membership removal immediately removes project and file access", async () => {
  await owner.agent
    .delete("/api/projects/" + id + "/members")
    .send({ email: reviewer.data.email })
    .expect(200);
  await reviewer.agent.get("/api/projects/" + id).expect(403);
  await reviewer.agent.get("/api/assets/" + v1).expect(403);
  await owner.agent
    .patch("/api/projects/" + id)
    .send({ op: "archive", value: true })
    .expect(200);
  assert.equal(
    (await owner.agent.get("/api/projects/" + id)).body.project.archived,
    1,
  );
  await owner.agent
    .patch("/api/projects/" + id)
    .send({ op: "archive", value: false })
    .expect(200);
});
test("sample studios initialize once even when requests arrive together", async () => {
  await Promise.all([
    stranger.agent.post("/api/studio").send({}).expect(200),
    stranger.agent.post("/api/studio").send({}).expect(200),
  ]);
  const detail = (await stranger.agent.get("/api/studio")).body;
  assert.equal(detail.projects.length, 6);
  assert.ok(detail.projects.every((p) => p.sample === 1));
  assert.equal(
    await Project.countDocuments({ ownerId: stranger.user.userId }),
    6,
  );
});

test("GridFS keeps private uploads available to a fresh server instance", async () => {
  const secret = "test-only-secret-" + suffix + suffix;
  const config = {
    secret,
    production: false,
    origins: new Set(["http://localhost:5174"]),
    uploadDir: path.join(uploads, "no-filesystem-needed"),
    uploadStorage: "gridfs",
  };
  const first = createApp(config),
    cookie = owner.cookie.split(";")[0];
  const created = await supertest(first)
    .post("/api/projects")
    .set("Cookie", cookie)
    .send({ name: "Durable uploads" })
    .expect(201);
  const png = await sharp({
    create: { width: 180, height: 120, channels: 3, background: "#d1b1b8" },
  })
    .png()
    .toBuffer();
  const uploaded = await supertest(first)
    .post("/api/projects/" + created.body.id + "/upload")
    .set("Cookie", cookie)
    .attach("file", png, "design.png")
    .expect(201);
  const v = await Version.findById(uploaded.body.id);
  assert.match(v.fileKey, /^gridfs:[a-f0-9]{24}$/);
  const record = await mongoose.connection.db
    .collection("designs.files")
    .findOne({ "metadata.versionId": v._id });
  assert.ok(record);
  assert.equal(record.length, png.length);
  const second = createApp(config);
  const asset = await supertest(second)
    .get("/api/assets/" + v._id)
    .set("Cookie", cookie)
    .expect(200);
  assert.equal(asset.headers["content-type"], "image/png");
  assert.match(asset.headers["cache-control"], /private/);
  assert.deepEqual(asset.body, png);
  const download = await supertest(second)
    .get("/api/assets/" + v._id + "?download=1")
    .set("Cookie", cookie)
    .expect(200);
  assert.match(download.headers["content-disposition"], /attachment/);
  assert.deepEqual(download.body, png);
  await stranger.agent.get("/api/assets/" + v._id).expect(403);
  await supertest(second)
    .get("/api/assets/" + v._id)
    .expect(401);
  const { deleteAsset } = await import("../server/services/assets.js");
  await deleteAsset(config, v.fileKey);
  assert.equal(
    await mongoose.connection.db
      .collection("designs.files")
      .countDocuments({ _id: record._id }),
    0,
  );
  assert.equal(
    await mongoose.connection.db
      .collection("designs.chunks")
      .countDocuments({ files_id: record._id }),
    0,
  );
  await supertest(second)
    .get("/api/assets/" + v._id)
    .set("Cookie", cookie)
    .expect(404);
});
