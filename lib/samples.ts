import { db, now, activity } from "./server";
import type { User } from "./types";
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
export async function initialize(u: User) {
  if (
    await db()
      .prepare("SELECT id FROM profiles WHERE id=?")
      .bind(u.userId)
      .first()
  )
    return;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(u.userId),
  );
  const tag = Array.from(new Uint8Array(digest))
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
  const time = now();
  const statements = [
    db()
      .prepare("INSERT OR IGNORE INTO profiles (id,created_at) VALUES (?,?)")
      .bind(u.userId, time),
  ];
  samples.forEach(([key, name, description, category, color, status], i) => {
    const id = `sample-${tag}-${key}`,
      v = `${id}-v1`,
      t = time - i * 7200000;
    statements.push(
      db()
        .prepare(
          "INSERT OR IGNORE INTO projects (id,owner_id,name,description,category,color,sample,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)",
        )
        .bind(id, u.userId, name, description, category, color, t, t),
    );
    statements.push(
      db()
        .prepare(
          "INSERT OR IGNORE INTO versions (id,project_id,number,file_key,file_name,mime,status,created_at) VALUES (?,?,1,?,?, 'image/svg+xml',?,?)",
        )
        .bind(v, id, `sample:${key}`, `${key}-concept.svg`, status, t),
    );
    statements.push(
      db()
        .prepare(
          "INSERT OR IGNORE INTO activities (id,project_id,actor,body,created_at) VALUES (?,?,?,?,?)",
        )
        .bind(
          `${id}-activity`,
          id,
          "Sample studio",
          "Created this sample project",
          t,
        ),
    );
    if (i === 0 || i === 1 || i === 4) {
      statements.push(
        db()
          .prepare(
            "INSERT OR IGNORE INTO comments (id,version_id,author_id,author_name,body,x,y,resolved,created_at) VALUES (?,?,?,?,?,?,?,0,?)",
          )
          .bind(
            `${id}-comment`,
            v,
            "sample-reviewer",
            "Maya (sample)",
            i === 0
              ? "Could we make the flower a little larger? I like how soft this feels."
              : i === 1
                ? "Can we try a darker green for the small text? It would be easier to read."
                : "The layout feels great. Could we give the headline a little more space?",
            i === 0 ? 0.62 : 0.5,
            i === 0 ? 0.38 : 0.55,
            t + 1000,
          ),
      );
    }
    if (i === 0) {
      statements.push(
        db()
          .prepare(
            "INSERT OR IGNORE INTO favorites (id,project_id,user_id) VALUES (?,?,?)",
          )
          .bind(`${id}-favorite`, id, u.userId),
      );
    }
  });
  await db().batch(statements);
}
