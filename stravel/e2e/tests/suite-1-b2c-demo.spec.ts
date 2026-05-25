import { test, expect } from "@playwright/test";
import { S, TEST_DATA } from "../fixtures/selectors";

test.describe("Suite 1 — B2C Demo Flow (UJ-2)", () => {
  test("1.1 Demo page loads without auth", async ({ page }) => {
    await page.goto("/demo");
    await expect(page.locator(S.demoLayout)).toBeVisible();
    await expect(page.locator(S.demoTitle)).toContainText("STravel");
  });

  test("1.2 Start demo session", async ({ page }) => {
    await page.goto("/demo");
    // Create session via API (no auth)
    const response = await page.request.post("/api/v1/demo/sessions");
    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.session_id).toBeTruthy();
  });

  test("1.3 Fact-finding conversation", async ({ page }) => {
    await page.goto("/demo");
    // Create session
    const createResp = await page.request.post("/api/v1/demo/sessions");
    const { session_id } = await createResp.json();

    // Send message
    const chatResp = await page.request.post(
      `/api/v1/demo/sessions/${session_id}/chat`,
      { data: { message: TEST_DATA.backpacker.message1 } }
    );
    expect(chatResp.status()).toBe(200);
    const chatData = await chatResp.json();
    expect(chatData.reply).toBeTruthy();
    expect(chatData.is_demo).toBe(true);
  });

  test("1.4 Get session status", async ({ page }) => {
    const createResp = await page.request.post("/api/v1/demo/sessions");
    const { session_id } = await createResp.json();

    await page.request.post(`/api/v1/demo/sessions/${session_id}/chat`, {
      data: { message: TEST_DATA.backpacker.message1 },
    });

    const statusResp = await page.request.get(`/api/v1/demo/sessions/${session_id}`);
    expect(statusResp.status()).toBe(200);
    const status = await statusResp.json();
    expect(status.messages.length).toBeGreaterThan(0);
  });

  test("1.5 Export endpoint exists", async ({ page }) => {
    const createResp = await page.request.post("/api/v1/demo/sessions");
    const { session_id } = await createResp.json();

    const exportResp = await page.request.get(`/api/v1/demo/sessions/${session_id}/export`);
    expect(exportResp.status()).toBe(200);
  });
});
