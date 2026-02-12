import { expect, test } from "@playwright/test";

test("home links to today", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /go to today's session/i })).toBeVisible();
});

test("/today shows unauthorized when not logged in", async ({ page }) => {
  await page.route("**/api/session/today", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "Unauthorized" }),
    });
  });

  await page.goto("/today");
  await expect(page.getByText("Unauthorized")).toBeVisible();
});
