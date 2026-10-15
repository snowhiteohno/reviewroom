import { test } from "node:test";
import assert from "node:assert/strict";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:5175";
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("API tests require a local built preview.");
const suffix = crypto.randomUUID(),
  owner = {
    id: "qa-owner-" + suffix,
    email: "owner-" + suffix + "@reviewroom.test",
    name: "QA Owner",
  },
  reviewer = {
    id: "qa-reviewer-" + suffix,
    email: "reviewer-" + suffix + "@reviewroom.test",
    name: "QA Reviewer",
  },
  editor = {
    id: "qa-editor-" + suffix,
    email: "editor-" + suffix + "@reviewroom.test",
    name: "QA Editor",
  },
  stranger = {
    id: "qa-stranger-" + suffix,
    email: "stranger-" + suffix + "@reviewroom.test",
    name: "QA Stranger",
  };
async function call(path, actor, body, expected = 200, extra = {}) {
  const headers = actor
    ? {
        "oai-authenticated-user-id": actor.id,
        "oai-authenticated-user-email": actor.email,
        "oai-authenticated-user-full-name": encodeURIComponent(actor.name),
        "oai-authenticated-user-full-name-encoding": "percent-encoded-utf-8",
      }
    : {};
  const res = await fetch(base + path, {
    method: body ? "POST" : "GET",
    headers: {
      ...headers,
      ...(body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...extra,
    },
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const text = await res.text();
  assert.equal(res.status, expected, path + ": " + text);
  return {
    res,
    data:
      text && res.headers.get("content-type")?.includes("json")
        ? JSON.parse(text)
        : text,
  };
}
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j4GQAAAAASUVORK5CYII=",
  "base64",
);
function file() {
  const f = new FormData();
  f.set("file", new File([png], "design.png", { type: "image/png" }));
  return f;
}
test("complete review flow, version isolation, access roles, and private files", async (t) => {
  await call("/api/studio", null, null, 401);
  const { data: created } = await call(
    "/api/studio",
    owner,
    {
      op: "create",
      name: "QA review flow",
      description: "Integration test project",
      category: "Branding",
      color: "rose",
    },
    201,
  );
  const path = "/api/projects/" + created.id;
  await t.test("origin validation and project isolation", async () => {
    await call(path, stranger, null, 403);
    const { data: list } = await call("/api/studio", stranger);
    assert.ok(!list.projects.some((p) => p.id === created.id));
    await call(
      path,
      owner,
      { op: "rename", name: "Blocked", description: "" },
      403,
      { origin: "https://untrusted.invalid" },
    );
  });
  let version;
  await t.test(
    "real file storage and concurrent version numbering",
    async () => {
      const results = await Promise.all([
        call(path + "/upload", owner, file(), 201),
        call(path + "/upload", owner, file(), 201),
        call(path + "/upload", owner, file(), 201),
      ]);
      assert.equal(new Set(results.map((r) => r.data.id)).size, 3);
      const { data: d } = await call(path, owner);
      assert.deepEqual(
        d.versions.map((v) => v.number),
        [3, 2, 1],
      );
      version = d.versions[0].id;
      await call("/api/assets/" + version, null, null, 401);
      await call("/api/assets/" + version, stranger, null, 403);
      const { res } = await call("/api/assets/" + version, owner);
      assert.equal(res.headers.get("content-type"), "image/png");
      assert.equal(res.headers.get("cache-control"), "private, no-store");
      const invalid = new FormData();
      invalid.set(
        "file",
        new File(["<svg></svg>"], "fake.png", { type: "image/png" }),
      );
      await call(path + "/upload", owner, invalid, 400);
    },
  );
  await t.test("shared access and role restrictions", async () => {
    await call(path, owner, {
      op: "member",
      email: reviewer.email.toUpperCase(),
      role: "reviewer",
    });
    await call(path, owner, {
      op: "member",
      email: editor.email,
      role: "editor",
    });
    const { data: shared } = await call("/api/studio", reviewer);
    assert.ok(shared.projects.some((p) => p.id === created.id));
    assert.equal((await call(path, reviewer)).data.role, "reviewer");
    await call(path + "/upload", reviewer, file(), 403);
    await call(
      path,
      reviewer,
      { op: "rename", name: "No", description: "" },
      403,
    );
    await call(
      path,
      editor,
      { op: "member", email: stranger.email, role: "editor" },
      403,
    );
    await call(path, editor, { op: "archive", value: true }, 403);
  });
  let rootId;
  await t.test(
    "pinned feedback, replies, resolution, and version isolation",
    async () => {
      await call(
        path,
        reviewer,
        {
          op: "comment",
          versionId: version,
          body: "Invalid coordinates",
          x: 2,
          y: 0.3,
        },
        400,
      );
      await call(path, owner, {
        op: "comment",
        versionId: version,
        body: "Make the title larger",
        x: 0.33,
        y: 0.62,
      });
      const { data: d } = await call(path, owner);
      const root = d.comments.find((c) => !c.parent_id);
      rootId = root.id;
      assert.equal(root.x, 0.33);
      assert.equal(root.y, 0.62);
      await call(path, reviewer, {
        op: "comment",
        versionId: version,
        body: "Agreed",
        parentId: rootId,
      });
      await call(
        path,
        reviewer,
        { op: "resolve", versionId: version, commentId: rootId, value: true },
        403,
      );
      await call(path, editor, {
        op: "resolve",
        versionId: version,
        commentId: rootId,
        value: true,
      });
      const { data: resolved } = await call(path, owner);
      assert.equal(resolved.comments.find((c) => c.id === rootId).resolved, 1);
      assert.equal(
        resolved.comments.filter((c) => c.parent_id === rootId).length,
        1,
      );
      await call(
        path,
        owner,
        {
          op: "comment",
          versionId: resolved.versions[1].id,
          body: "Wrong parent",
          parentId: rootId,
        },
        400,
      );
    },
  );
  await t.test("review transitions and decisions", async () => {
    await call(
      path,
      reviewer,
      { op: "status", versionId: version, status: "approved" },
      409,
    );
    await call(
      path,
      reviewer,
      { op: "status", versionId: version, status: "in_review" },
      403,
    );
    await call(path, editor, {
      op: "status",
      versionId: version,
      status: "in_review",
    });
    await call(
      path,
      editor,
      { op: "status", versionId: version, status: "approved" },
      403,
    );
    await call(path, reviewer, {
      op: "status",
      versionId: version,
      status: "changes_requested",
    });
    await call(path, editor, {
      op: "status",
      versionId: version,
      status: "in_review",
    });
    await call(path, reviewer, {
      op: "status",
      versionId: version,
      status: "approved",
    });
    const { data: d } = await call(path, owner);
    assert.equal(d.versions[0].status, "approved");
    assert.equal(d.versions[1].status, "draft");
    await call(
      path,
      reviewer,
      { op: "status", versionId: version, status: "changes_requested" },
      409,
    );
    await call(
      path,
      owner,
      { op: "status", versionId: d.versions[1].id, status: "in_review" },
      409,
    );
  });
  await t.test(
    "concurrent review decisions produce one decision and one activity record",
    async () => {
      await call(path, owner, {
        op: "status",
        versionId: version,
        status: "draft",
      });
      await call(path, owner, {
        op: "status",
        versionId: version,
        status: "in_review",
      });
      const before = (await call(path, owner)).data.activity.length;
      const decide = async (status) => {
        const res = await fetch(base + path, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "oai-authenticated-user-id": reviewer.id,
            "oai-authenticated-user-email": reviewer.email,
          },
          body: JSON.stringify({ op: "status", versionId: version, status }),
        });
        return res.status;
      };
      const outcomes = await Promise.all([
        decide("approved"),
        decide("changes_requested"),
      ]);
      assert.deepEqual(outcomes.sort(), [200, 409]);
      const after = (await call(path, owner)).data;
      assert.equal(after.activity.length, before + 1);
      assert.ok(
        ["approved", "changes_requested"].includes(after.versions[0].status),
      );
    },
  );
  await t.test(
    "personal favorites, membership removal, archive and restore",
    async () => {
      await call(path, reviewer, { op: "star", value: true });
      assert.equal((await call(path, reviewer)).data.project.starred, 1);
      assert.equal((await call(path, owner)).data.project.starred, 0);
      await call(path, owner, { op: "remove-member", email: reviewer.email });
      await call(path, reviewer, null, 403);
      await call("/api/assets/" + version, reviewer, null, 403);
      await call(path, owner, { op: "archive", value: true });
      assert.equal((await call(path, owner)).data.project.archived, 1);
      await call(path, owner, { op: "archive", value: false });
      assert.equal((await call(path, owner)).data.project.archived, 0);
      await call(path, owner, { op: "archive", value: true });
    },
  );
});
