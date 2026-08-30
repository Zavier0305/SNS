// Lightweight smoke test: boots headless Chromium against a running `next dev`/`next start`
// server, mocks every Supabase REST/Auth/Storage call so it never touches the network, then
// visits every top-level page and fails if React's route error boundary is shown or any
// uncaught client-side exception is thrown.
//
// This exists because the app has zero automated tests otherwise, and a real production
// crash (a duplicate Realtime subscription on /notifications) shipped and went unnoticed
// until a user hit it live. Mocking the backend like this is also how that bug was actually
// reproduced and root-caused — see .claude/skills/feature-cycle-loop/SKILL.md.
//
// Usage: node tests/smoke.mjs [baseURL]
//   BASE_URL env var or first arg overrides the default http://localhost:3000
//   PLAYWRIGHT_CHROMIUM_PATH env var overrides the Chromium executable Playwright launches
//   (needed in this sandbox's remote dev environment; CI installs its own via
//   `npx playwright install chromium` and doesn't need this set).

import { chromium } from "playwright";

const BASE_URL = process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000";
const SUPABASE_HOST = "kwlydqelkovmopyjymyz.supabase.co";
const FAKE_USER_ID = "11111111-1111-4111-8111-111111111111";
const NOW = new Date().toISOString();

function makeProfileRow() {
  return {
    id: FAKE_USER_ID,
    handle: "smoketest",
    display_name: "SmokeTest",
    created_at: NOW,
    theme_color: "#3366ff",
    bio: "smoke test profile",
    cover_url: null,
    pinned_post_id: null,
    notify_likes: true,
    notify_comments: true,
    notify_follows: true,
  };
}

function makeFeedRow() {
  return {
    id: "p1",
    author_id: FAKE_USER_ID,
    author_handle: "smoketest",
    author_display_name: "SmokeTest",
    content: "smoke test post #tag https://example.com",
    image_url: null,
    image_urls: null,
    created_at: NOW,
    expire_at: NOW,
    is_preserved: false,
    is_hidden: false,
    channel_id: null,
    is_pinned: false,
    quoted_post_id: null,
    quoted_content: null,
    quoted_author_handle: null,
    quoted_author_display_name: null,
    poll_options: null,
    like_count: 1,
    comment_count: 1,
    is_sensitive: false,
  };
}

async function installMocks(page) {
  await page.route(`**://${SUPABASE_HOST}/**`, async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    const json = (body, extraHeaders) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        headers: extraHeaders,
        body: JSON.stringify(body),
      });

    if (url.includes("/auth/v1/signup") || url.includes("/auth/v1/token")) {
      return json({
        access_token: "fake-access-token",
        token_type: "bearer",
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        refresh_token: "fake-refresh-token",
        user: {
          id: FAKE_USER_ID,
          aud: "authenticated",
          role: "authenticated",
          is_anonymous: true,
          app_metadata: {},
          user_metadata: {},
          created_at: NOW,
        },
      });
    }
    if (url.includes("/auth/v1/user")) {
      return json({
        id: FAKE_USER_ID,
        aud: "authenticated",
        role: "authenticated",
        is_anonymous: true,
        app_metadata: {},
        user_metadata: {},
        created_at: NOW,
      });
    }
    if (url.includes("/rest/v1/sns_profiles") && method === "GET") {
      const accept = req.headers()["accept"] || "";
      const isSingle = accept.includes("vnd.pgrst.object");
      const row = makeProfileRow();
      return json(isSingle ? row : [row]);
    }
    if (url.includes("/rest/v1/sns_servers") && method === "GET") {
      return json([
        { id: "s1", name: "Smoke Server", topic: "topic", owner_id: FAKE_USER_ID, is_public: true, created_at: NOW },
      ]);
    }
    if (url.includes("/rest/v1/sns_server_members")) {
      return json([{ server_id: "s1", user_id: FAKE_USER_ID, role: "owner", sns_profiles: { handle: "smoketest", display_name: "SmokeTest" } }]);
    }
    if (url.includes("/rest/v1/sns_channels")) {
      return json([{ id: "c1", server_id: "s1", name: "general", created_at: NOW, posts_locked: false }]);
    }
    if (url.includes("/rest/v1/sns_posts")) {
      return json([], { "content-range": "0-0/0" });
    }
    if (url.includes("/rest/v1/sns_feed")) {
      return json([makeFeedRow()]);
    }
    if (url.includes("/rest/v1/sns_notifications")) {
      return json([], { "content-range": "0-0/0" });
    }
    if (method === "PATCH" || method === "POST") {
      return json([]);
    }
    return json([]);
  });

  await page.routeWebSocket(`**://${SUPABASE_HOST}/**`, () => {});
}

async function run() {
  const launchOpts = {};
  if (process.env.PLAYWRIGHT_CHROMIUM_PATH) {
    launchOpts.executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH;
  }
  const browser = await chromium.launch(launchOpts);
  const page = await browser.newPage();
  const failures = [];

  page.on("pageerror", (err) => {
    failures.push({ page: page.url(), kind: "pageerror", message: err.message });
  });

  await installMocks(page);

  await page.goto(`${BASE_URL}/login`, { waitUntil: "networkidle", timeout: 30000 });
  await page.fill('input[placeholder="ニックネーム（任意）"]', "SmokeTest");
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  const routes = [
    "/",
    "/explore",
    "/search",
    "/bookmarks",
    "/likes",
    "/servers",
    "/servers/s1",
    "/battle",
    "/profile",
    "/u/smoketest",
    "/settings",
    "/staff-k7v2q",
    "/notifications",
    "/post/p1",
  ];

  for (const routePath of routes) {
    const before = failures.length;
    await page
      .goto(`${BASE_URL}${routePath}`, { waitUntil: "networkidle", timeout: 20000 })
      .catch((e) => failures.push({ page: routePath, kind: "navigation", message: e.message }));
    await page.waitForTimeout(1000);
    const bodyText = await page.locator("body").innerText().catch(() => "");
    if (bodyText.includes("エラーが発生しました")) {
      failures.push({ page: routePath, kind: "error-boundary", message: "route error boundary shown" });
    }
    const newFailures = failures.length - before;
    console.log(`${newFailures === 0 ? "PASS" : "FAIL"}  ${routePath}`);
  }

  await browser.close();

  if (failures.length > 0) {
    console.error("\nSmoke test failures:");
    for (const f of failures) {
      console.error(`  [${f.kind}] ${f.page}: ${f.message}`);
    }
    process.exit(1);
  }
  console.log(`\nAll ${routes.length} routes passed.`);
}

run().catch((err) => {
  console.error("Smoke test crashed:", err);
  process.exit(1);
});
