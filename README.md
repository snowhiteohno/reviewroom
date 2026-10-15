# ReviewRoom

A collaborative design review studio with a soft, paper-inspired interface. Upload a design, leave feedback at a specific point, add revisions, and approve the final version.

Source owner: [Mallika](https://github.com/snowhiteohno). The project is kept on the personal GitHub account and runs locally. It is not published through the connected Sites account.

## What works

- Project creation, descriptions, categories, personal favorites, search, filters, grid and list views, and archiving.
- Private image uploads to Cloudflare R2. PNG, JPEG, WebP, and GIF files are accepted up to 12 MB. Uploads are checked by file signature.
- Sequential version numbers assigned atomically in the database, including simultaneous uploads.
- Pinned comments stored as normalized coordinates. Annotations remain aligned when the canvas resizes or zooms.
- Threaded replies, resolved discussions, and separate feedback for each version.
- Side by side version comparison.
- Review requests, change requests, approval, and reopening an approved version.
- Owner, editor, and reviewer permissions enforced on the server.
- Sharing by email address and a copied project link.
- Durable project activity and a studio activity feed.
- Responsive layouts, keyboard focus states, native accessible dialogs, reduced motion support, and loading, empty, and error states.

The six starter projects are clearly labeled samples. Their artwork is original SVG illustration included in this repository. Sample comments are marked as samples. A starter studio is created once for each signed-in user.

## Stack

| Layer          | Technology                                           |
| -------------- | ---------------------------------------------------- |
| Interface      | React 19, TypeScript, CSS, Lucide icons              |
| Application    | Vinext using the Next.js App Router conventions      |
| Runtime        | Cloudflare Workers                                   |
| Database       | Cloudflare D1, SQLite, Drizzle schema and migrations |
| File storage   | Cloudflare R2                                        |
| Authentication | Sites-managed ChatGPT sign-in                        |
| Testing        | Node test runner and Playwright against Chrome       |

There are no paid API dependencies and no AI API key is needed.

## Run locally

Requires Node.js 22.13 or newer and npm.

```sh
npm ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_safe_kinsey_walden.sql
npm run dev -- --port 5174
```

Apply each migration once to a fresh local database. Local files and records persist under the ignored .wrangler/state directory.

Open http://127.0.0.1:5174. The portable development server provides a local sign-in account called Mallika. The app redirects through its local sign-in route automatically. Hosted sign-in uses the actual visitor identity.

For later starts, use npm run dev. Rebuild after changing bindings. After a schema change, run npm run db:generate, inspect the generated SQL, build, and apply only new migrations.

## A short demo

1. Create a project and upload a design image.
2. Select Add pin, click the design, and post a comment.
3. Reply to the conversation, resolve it, and reopen it.
4. Upload a second image. It appears as a new version with its own feedback.
5. Select Compare to inspect both images together.
6. Request a review. A reviewer or owner can request changes or approve.
7. Open Share, add a teammate as an editor or reviewer, and copy the link.
8. Reload to confirm that versions, comments, access, and review state persist.

## Permissions

| Action                         | Owner | Editor | Reviewer     |
| ------------------------------ | ----- | ------ | ------------ |
| View files and feedback        | Yes   | Yes    | Yes          |
| Comment and reply              | Yes   | Yes    | Yes          |
| Resolve any conversation       | Yes   | Yes    | Own comments |
| Upload revisions               | Yes   | Yes    | No           |
| Edit project details           | Yes   | Yes    | No           |
| Request review or reopen draft | Yes   | Yes    | No           |
| Approve or request changes     | Yes   | No     | Yes          |
| Manage access or archive       | Yes   | No     | No           |
| Personal favorite              | Yes   | Yes    | Yes          |

Only the latest version can change review state. A review decision requires the version to be in review. Review updates use a compare-and-set operation so concurrent decisions cannot silently overwrite one another.

Adding a collaborator records access; it does not send email. Share the copied link yourself. Sites publications start owner-private, so a teammate also needs permission to visit the hosted Site. Application-level membership does not override the hosting audience.

## Architecture

The browser renders the studio and review canvas. All project operations go through server routes. Each request obtains the signed-in identity and checks ownership or email membership before returning records or reading R2.

D1 stores projects, versions, comments, members, personal favorites, profiles, and activity. R2 stores uploaded bytes under generated keys. Files are served through an authenticated route with private cache headers; knowing a version ID does not grant access.

A revision upload writes its file first, then inserts the version and activity in a database batch. A failed database operation removes the uploaded object. Version numbers are allocated inside a single INSERT SELECT statement and protected by a unique index.

Pinned coordinates are proportions from zero to one relative to the displayed image. Replies belong to a root comment on the same version. Version history preserves each previous review decision.

The activity feed refreshes every 20 seconds while the page is visible. Mutations refresh the current project immediately.

Authentication headers are supplied by the trusted Sites edge. The built Worker is intended to run behind that edge. The local built preview accepts test identity headers for integration testing and binds to loopback.

## Verification

```sh
npm run typecheck
npm run build
npm start -- --port 5175
```

In another terminal:

```sh
npm run test:api
```

The API suite runs only against a local built preview. It covers project isolation, unauthorized file access, roles, signature validation, concurrent revision uploads, normalized pins, replies, version isolation, review decisions, favorites, membership removal, and archiving. Its test records are isolated under generated test identities.

For the browser suite, run the development server on port 5174 and a Chrome instance with remote debugging enabled. The suite connects to http://localhost:9222 by default:

```sh
npm run test:ui
```

CHROME_CDP_URL and UI_BASE_URL can override the defaults. The suite creates and archives a test project, exercises the full review flow, checks desktop and mobile layout, verifies pin alignment after resizing, and saves screenshots under the ignored artifacts directory. Browser tests use the connected browser's local sign-in account.

## Source layout

- app/studio.tsx: project dashboard, navigation, and studio state.
- app/review.tsx: review canvas, annotation placement, version comparison, and conversations.
- components/studio-ui.tsx: dialogs, forms, sharing, status badges, and shared UI.
- app/api: authenticated project, upload, asset, and studio routes.
- lib/server.ts: database access, identity, authorization, input validation, and error handling.
- lib/samples.ts: idempotent sample studio setup.
- db/schema.ts and drizzle: schema and versioned SQL migrations.
- public/samples: original sample artwork.
- tests/api.test.mjs and scripts/ui-check.mjs: integration and browser verification.

## Project scope

This release reviews image designs and screenshots. PDF markup, video review, email delivery, and live cursors are outside this version. The class repository's complete guidelines have not been supplied, so final submission-specific requirements still need to be checked against that document.
