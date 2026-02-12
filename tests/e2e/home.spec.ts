import { expect, test } from "@playwright/test";

test("home links to today", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /go to today's session/i })).toBeVisible();
});
