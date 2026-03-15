import { expect, test } from "@playwright/test";

test("admin login page renders key controls", async ({ page }) => {
  await page.goto("/admin/login");

  await expect(
    page.getByRole("heading", { name: "Все запчасти" }),
  ).toBeVisible();
  await expect(page.getByText("Вход в админ-панель")).toBeVisible();
  await expect(page.locator("input[type='email']")).toBeVisible();
  await expect(page.locator("input[type='password']")).toBeVisible();
  await expect(page.getByRole("button", { name: "Войти" })).toBeVisible();
});
