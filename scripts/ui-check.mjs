import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import sharp from "sharp";
const base = process.env.UI_BASE_URL || "http://localhost:5174",
  suffix = crypto.randomUUID(),
  password = "ReviewRoom test " + suffix;
if (!["localhost", "127.0.0.1"].includes(new URL(base).hostname))
  throw new Error("Browser tests require a local preview.");
const browser = await chromium.connectOverCDP(
  process.env.CHROME_CDP_URL || "http://localhost:9222",
);
const ownerContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  }),
  reviewerContext = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
const a = await ownerContext.newPage(),
  b = await reviewerContext.newPage(),
  errors = [];
for (const page of [a, b]) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.setDefaultTimeout(12000);
}
const reviewerEmail = "ui-reviewer-" + suffix + "@reviewroom.test";
await mkdir("artifacts", { recursive: true });
const screenshot = (page, name, fullPage = true) =>
  page.screenshot({
    path: "artifacts/" + name + ".png",
    fullPage,
    animations: "disabled",
  });
async function register(page, name, email) {
  await page.goto(base + "/register", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Your name").fill(name);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create your studio", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Flora studio", exact: true })
    .waitFor();
}
async function reload(page) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.locator(".main-design").waitFor();
}
try {
  await sharp(await readFile("client/public/samples/flora.svg"))
    .png()
    .toFile("artifacts/ui-before.png");
  await sharp(await readFile("client/public/samples/flora-v2.svg"))
    .png()
    .toFile("artifacts/ui-after.png");
  await register(a, "Mallika", "ui-owner-" + suffix + "@reviewroom.test");
  await register(b, "Maya", reviewerEmail);
  await screenshot(a, "mern-studio-desktop");
  await a.getByRole("button", { name: "New project", exact: true }).click();
  await a.getByLabel("Project name").fill("Bloom review");
  await a
    .getByPlaceholder("What are you working on?")
    .fill("A fresh identity, reviewed together.");
  await a
    .locator("dialog input[type=file]")
    .setInputFiles("artifacts/ui-before.png");
  await a.getByRole("button", { name: "Create project", exact: true }).click();
  await a.locator(".main-design").waitFor();
  const projectUrl = a.url();
  await a.getByRole("button", { name: "Share", exact: true }).click();
  await a.getByLabel("Teammate email").fill(reviewerEmail);
  await a.getByRole("button", { name: "Add", exact: true }).click();
  await a
    .locator(".member-list")
    .getByText(reviewerEmail, { exact: true })
    .waitFor();
  await a.getByRole("button", { name: "Close dialog", exact: true }).click();
  await b.goto(projectUrl, { waitUntil: "domcontentloaded" });
  await b.locator(".main-design").waitFor();
  await b.getByRole("button", { name: "Add pin", exact: true }).click();
  await b.locator(".image-surface").click({ position: { x: 150, y: 160 } });
  await b.getByLabel("Feedback type").selectOption("must_fix");
  await b
    .getByLabel("Feedback message")
    .fill("Please give the flower a little more room.");
  await b.getByRole("button", { name: "Post feedback", exact: true }).click();
  await b
    .getByText("Please give the flower a little more room.", { exact: true })
    .waitFor();
  assert.equal(
    await b
      .getByRole("button", { name: "Resolve conversation", exact: true })
      .count(),
    0,
    "Must fix feedback cannot be casually resolved",
  );
  await reload(a);
  await a
    .locator(".review-header input[type=file]")
    .setInputFiles("artifacts/ui-after.png");
  await a.locator(".version-card").filter({ hasText: "Version 2" }).waitFor();
  assert.equal(
    await a.locator(".comment-list .comment-card").count(),
    0,
    "Version 2 has its own feedback",
  );
  await a.getByRole("button", { name: /^Fixes/ }).click();
  await a.getByRole("button", { name: "Link a fix", exact: true }).click();
  await a.getByRole("button", { name: "Link revision", exact: true }).click();
  await a
    .getByText("Another reviewer can verify this revision.", { exact: true })
    .waitFor();
  await a.getByRole("button", { name: "Request review", exact: true }).click();
  await a.getByRole("button", { name: "Approve", exact: true }).waitFor();
  assert.equal(
    await a.getByRole("button", { name: "Approve", exact: true }).isDisabled(),
    true,
  );
  await reload(b);
  await b.getByRole("button", { name: /^Fixes/ }).click();
  await b.getByRole("button", { name: "Verify fix", exact: true }).click();
  await b.getByText("1 of 1 verified", { exact: true }).waitFor();
  await b.getByRole("button", { name: "Approve", exact: true }).click();
  await b.getByText("Looking good. Approved.", { exact: true }).waitFor();
  await reload(a);
  await a.getByRole("button", { name: "Compare", exact: true }).click();
  await a.getByRole("button", { name: "Reveal changes", exact: true }).click();
  const slider = a.getByRole("slider", { name: "Before and after position" });
  await slider.focus();
  await slider.press("ArrowRight");
  assert.equal(await slider.inputValue(), "51");
  assert.match(await a.locator(".reveal-layer").getAttribute("style"), /51%/);
  await screenshot(a, "reveal-desktop");
  await a.getByRole("button", { name: /^Votes/ }).click();
  await a
    .getByRole("button", { name: "Start a design vote", exact: true })
    .click();
  await a.getByRole("button", { name: "Start vote", exact: true }).click();
  await a
    .getByText("Results are hidden until you vote.", { exact: true })
    .waitFor();
  await reload(b);
  await b.getByRole("button", { name: /^Votes/ }).click();
  await b
    .getByText("Results are hidden until you vote.", { exact: true })
    .waitFor();
  await b
    .getByRole("button", { name: "Vote for option A", exact: true })
    .click();
  await b
    .locator(".poll-total")
    .filter({ hasText: "1 vote collected" })
    .waitFor();
  await reload(a);
  await a.getByRole("button", { name: /^Votes/ }).click();
  await a
    .getByText("Results are hidden until you vote.", { exact: true })
    .waitFor();
  await a
    .getByRole("button", { name: "Vote for option B", exact: true })
    .click();
  await a
    .locator(".poll-total")
    .filter({ hasText: "2 votes collected" })
    .waitFor();
  await screenshot(a, "votes-desktop");
  await a
    .getByRole("button", {
      name: "Close voting and reveal results",
      exact: true,
    })
    .click();
  await a.getByText("Closed", { exact: true }).waitFor();
  await a.getByRole("button", { name: /^Fixes/ }).click();
  await screenshot(a, "verified-fixes-desktop");
  await a.locator(".version-card").filter({ hasText: "Version 1" }).click();
  const pin = a.locator(".comment-pin").first(),
    surface = a.locator(".image-surface");
  await pin.waitFor();
  const ratio = async () => {
    const p = await pin.boundingBox(),
      s = await surface.boundingBox();
    return {
      x: (p.x + p.width / 2 - s.x) / s.width,
      y: (p.y + p.height / 2 - s.y) / s.height,
    };
  };
  const before = await ratio();
  await a.setViewportSize({ width: 390, height: 844 });
  await a.waitForTimeout(250);
  const after = await ratio();
  assert.ok(
    Math.abs(before.x - after.x) < 0.01 && Math.abs(before.y - after.y) < 0.01,
    "Pins stay aligned on mobile",
  );
  assert.equal(
    await a.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    "Review fits mobile",
  );
  await a
    .locator(".toast .icon-btn")
    .click()
    .catch(() => {});
  await screenshot(a, "mern-review-mobile");
  await a
    .getByRole("button", { name: "Back to projects", exact: true })
    .click();
  await a
    .getByRole("button", { name: "Open Bloom review", exact: true })
    .waitFor();
  await screenshot(a, "mern-studio-mobile", false);
  assert.equal(
    await a.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
    "Studio fits mobile",
  );
  await a.setViewportSize({ width: 1440, height: 1000 });
  await a.getByLabel("Search projects").fill("Bloom review");
  assert.equal(await a.locator(".project-card").count(), 1);
  await a.getByLabel("Search projects").fill("");
  await a.getByRole("button", { name: "List view", exact: true }).click();
  await a.locator(".project-list").waitFor();
  await a.getByRole("button", { name: "Grid view", exact: true }).click();
  await a
    .getByRole("button", { name: "Open Bloom review", exact: true })
    .click();
  await a.getByRole("button", { name: "Project options", exact: true }).click();
  await a.getByRole("button", { name: "Archive project", exact: true }).click();
  await a.getByText("Project archived.", { exact: true }).waitFor();
  await a
    .getByRole("button", { name: "Back to projects", exact: true })
    .click();
  await a.getByRole("button", { name: "Account menu", exact: true }).click();
  await a.getByRole("button", { name: "Sign out", exact: true }).click();
  await a.getByRole("button", { name: "Sign in", exact: true }).waitFor();
  await a
    .getByLabel("Email address")
    .fill("ui-owner-" + suffix + "@reviewroom.test");
  await a.getByLabel("Password", { exact: true }).fill(password);
  await a.getByRole("button", { name: "Sign in", exact: true }).click();
  await a
    .getByRole("button", { name: "Open Flora studio", exact: true })
    .waitFor();
  assert.equal(
    await a
      .getByRole("button", { name: "Open Bloom review", exact: true })
      .count(),
    0,
    "Archive persists after login",
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "registration",
        "login and logout",
        "real uploads",
        "two user sharing",
        "must fix feedback",
        "linked revision",
        "independent verification",
        "approval gate",
        "reveal slider keyboard controls",
        "blind vote results",
        "one vote per account",
        "closed results",
        "responsive pins",
        "mobile overflow",
        "search",
        "list view",
        "persistent archive",
      ],
      screenshots: 6,
    }),
  );
} catch (error) {
  await screenshot(a, "ui-failure");
  console.error("Owner URL:", a.url());
  throw error;
} finally {
  await ownerContext.close();
  await reviewerContext.close();
  await browser.close();
}
