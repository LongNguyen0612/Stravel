import { test, expect } from "@playwright/test";
import { S, TEST_DATA } from "../fixtures/selectors";

test.describe("Suite 2 — B2B Copilot Flow (UJ-1)", () => {
  let token: string;

  test.beforeAll(async ({ request }) => {
    const email = `e2e-agent-${Date.now()}-${Math.random().toString(36).slice(2)}@stravel.dev`;
    const password = "TestPass123!";

    // Register test agent
    const regResp = await request.post("/api/v1/auth/register", {
      data: { email, password, full_name: "E2E Test Agent", tenant_name: "E2E Agency" },
    });

    if (regResp.status() === 201) {
      const data = await regResp.json();
      token = data.access_token;
    } else if (regResp.status() === 409) {
      // User exists — login instead
      const loginResp = await request.post("/api/v1/auth/login", {
        data: { email, password },
      });
      if (loginResp.status() === 200) {
        const data = await loginResp.json();
        token = data.access_token;
      }
    }
  });

  test("2.1 Copilot layout loads", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(S.copilotLayout)).toBeVisible();
    await expect(page.locator(S.sessionPanel)).toBeVisible();
    await expect(page.locator(S.copilotSidebar)).toBeVisible();
  });

  test("2.2 Create advisory session with auth", async ({ request }) => {
    const resp = await request.post("/api/v1/advisory_sessions", {
      headers: { Authorization: `Bearer ${token}` },
      data: {},
    });
    expect(resp.status()).toBe(201);
    const data = await resp.json();
    expect(data.status).toBe("in_progress");
    expect(data.traveler_profile).toBeTruthy();
  });

  test("2.3 Session requires auth", async ({ request }) => {
    const resp = await request.get("/api/v1/advisory_sessions");
    expect(resp.status()).toBe(401);
  });

  test("2.4 Health endpoint is public", async ({ request }) => {
    const resp = await request.get("/api/v1/health");
    expect(resp.status()).toBe(200);
    const data = await resp.json();
    expect(data.status).toBe("ok");
  });

  test("2.5 SSE endpoint requires auth", async ({ request }) => {
    const resp = await request.get("/api/v1/stream/fake-session-id");
    expect(resp.status()).toBe(401);
  });
});
