import { chromium } from "playwright-core";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.UI_BASE_URL || "http://localhost:5174";
const browser = await chromium.connectOverCDP(
  process.env.CHROME_CDP_URL || "http://localhost:9222",
);
const context = browser.contexts()[0];
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await mkdir("artifacts", { recursive: true });
try {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + "/signin-with-chatgpt?return_to=/", {
    waitUntil: "networkidle",
  });
  await page.locator(".project-card").first().waitFor();
  await page.screenshot({
    path: "artifacts/studio-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  const source = await context.newPage();
  await source.goto(base + "/samples/flora.svg");
  await source
    .locator("svg")
    .screenshot({ path: "artifacts/upload-design.png" });
  await source.close();
  await page.getByRole("button", { name: "New project", exact: true }).click();
  await page.getByLabel("Project name").fill("Bloom review");
  await page
    .getByPlaceholder("What are you working on?")
    .fill("A fresh identity for a local flower studio.");
  await page
    .locator("dialog input[type=file]")
    .setInputFiles("artifacts/upload-design.png");
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .click();
  await page.locator(".main-design").waitFor();
  await page.getByRole("button", { name: "Add pin", exact: true }).click();
  await page.locator(".image-surface").click({ position: { x: 150, y: 160 } });
  await page
    .getByLabel("Feedback message")
    .fill("Could we give this heading a little more space?");
  await page
    .getByRole("button", { name: "Post feedback", exact: true })
    .click();
  await page
    .getByText("Could we give this heading a little more space?", {
      exact: true,
    })
    .waitFor();
  assert.equal(await page.locator(".comment-pin").count(), 1);
  await page.getByRole("button", { name: "Reply", exact: true }).click();
  await page
    .getByLabel("Reply to feedback")
    .fill("I will adjust it in the next version.");
  await page.getByRole("button", { name: "Send reply", exact: true }).click();
  await page
    .getByText("I will adjust it in the next version.", { exact: true })
    .waitFor();
  await page
    .getByRole("button", { name: "Resolve conversation", exact: true })
    .click();
  await page.getByText("All caught up", { exact: true }).waitFor();
  await page.getByLabel("Filter feedback").selectOption("resolved");
  await page
    .getByRole("button", { name: "Reopen conversation", exact: true })
    .click();
  await page.getByLabel("Filter feedback").selectOption("open");
  await page
    .locator(".review-header input[type=file]")
    .setInputFiles("artifacts/upload-design.png");
  await page
    .locator(".version-card")
    .filter({ hasText: "Version 2" })
    .waitFor();
  assert.equal(
    await page.locator(".comment-list .comment-card").count(),
    0,
    "New versions isolate feedback",
  );
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  assert.equal(await page.locator(".compare-image").count(), 2);
  await page.screenshot({
    path: "artifacts/compare-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await page
    .getByRole("button", { name: "Request review", exact: true })
    .click();
  await page.getByRole("button", { name: "Approve", exact: true }).click();
  await page.getByText("Looking good. Approved.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await page.getByLabel("Teammate email").fill("teammate@example.com");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page
    .locator(".member-list")
    .getByText("teammate@example.com", { exact: true })
    .waitFor();
  await page.getByRole("button", { name: "Close dialog", exact: true }).click();
  await page.locator(".version-card").filter({ hasText: "Version 1" }).click();
  assert.equal(await page.locator(".comment-list .comment-card").count(), 1);
  await page.screenshot({
    path: "artifacts/review-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  const pin = page.locator(".comment-pin").first(),
    surface = page.locator(".image-surface");
  const ratio = async () => {
    const p = await pin.boundingBox(),
      s = await surface.boundingBox();
    return {
      x: (p.x + p.width / 2 - s.x) / s.width,
      y: (p.y + p.height / 2 - s.y) / s.height,
    };
  };
  const before = await ratio();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  const after = await ratio();
  assert.ok(
    Math.abs(before.x - after.x) < 0.01 && Math.abs(before.y - after.y) < 0.01,
    "Pins stay aligned after resize",
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "Review fits mobile viewport",
  );
  await page
    .locator(".toast .icon-btn")
    .click()
    .catch(() => {});
  await page.screenshot({
    path: "artifacts/review-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Back to projects", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Bloom review", exact: true })
    .waitFor();
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    "Studio fits mobile viewport",
  );
  await page.locator(".project-card img").first().waitFor();
  await page.screenshot({
    path: "artifacts/studio-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "List view", exact: true }).click();
  await page.locator(".project-list").waitFor();
  await page.getByRole("button", { name: "Grid view", exact: true }).click();
  await page.getByLabel("Search projects").fill("Bloom review");
  assert.equal(await page.locator(".project-card").count(), 1);
  await page.getByLabel("Search projects").fill("");
  await page
    .getByRole("button", { name: "Open Bloom review", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Project options", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Archive project", exact: true })
    .click();
  await page.getByText("Project archived.", { exact: true }).waitFor();
  await page
    .getByRole("button", { name: "Back to projects", exact: true })
    .click();
  assert.equal(
    await page
      .getByRole("button", { name: "Open Bloom review", exact: true })
      .count(),
    0,
  );
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify({
      passed: true,
      checks: [
        "create",
        "real image upload",
        "pinned feedback",
        "replies",
        "resolve and reopen",
        "new version",
        "feedback isolation",
        "compare",
        "review and approval",
        "sharing",
        "responsive pin coordinates",
        "mobile overflow",
        "search",
        "list view",
        "archive",
      ],
      screenshots: 5,
    }),
  );
} finally {
  await page.close();
  await browser.close();
}
