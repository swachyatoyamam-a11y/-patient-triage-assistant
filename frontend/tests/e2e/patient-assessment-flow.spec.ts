import { test, expect } from "@playwright/test";

/**
 * Requires a real running stack (see playwright.config.ts + tests/e2e/README.md):
 * - Backend running with a migrated + seeded database (npm run prisma:seed)
 * - A patient test account already registered — this suite does not create
 *   one via the UI, since patient registration isn't exposed there yet
 *   (only /api/auth/register directly). Seed one via the API before running:
 *
 *     curl -X POST http://localhost:4000/api/auth/register \
 *       -H "Content-Type: application/json" \
 *       -d '{"email":"e2e-patient@example.com","password":"testpass123",
 *            "firstName":"E2E","lastName":"Patient","role":"PATIENT",
 *            "dateOfBirth":"1990-01-01","sex":"Female"}'
 */
const TEST_PATIENT_EMAIL = process.env.E2E_PATIENT_EMAIL ?? "e2e-patient@example.com";
const TEST_PATIENT_PASSWORD = process.env.E2E_PATIENT_PASSWORD ?? "testpass123";

test.describe("patient login and assessment submission", () => {
  test("logs in, submits a routine-symptom assessment, and sees a result", async ({ page }) => {
    await page.goto("/login/patient");

    await page.getByLabel("Email").fill(TEST_PATIENT_EMAIL);
    await page.getByLabel("Password").fill(TEST_PATIENT_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByText("Your care overview")).toBeVisible();

    await page.getByRole("link", { name: "New assessment" }).click();
    await expect(page).toHaveURL(/\/assessment\/new/);

    await page.getByPlaceholder("e.g. 34").fill("29");
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByRole("button", { name: "Female" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByPlaceholder(/chest pain, sore throat/i).fill("runny nose and mild cough");
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByRole("button", { name: "1", exact: true }).click(); // low pain level
    await page.getByRole("button", { name: "Next" }).click();

    await page.getByPlaceholder("e.g. 6").fill("24");
    await page.getByRole("button", { name: "Next" }).click();

    // Temperature, additional symptoms, medical history, medications — all
    // optional, click through.
    for (let i = 0; i < 4; i++) {
      await page.getByRole("button", { name: "Next" }).click();
    }

    // sex=Female means the pregnancy question DOES appear here.
    await expect(page.getByText("currently pregnant")).toBeVisible();
    await page.getByRole("button", { name: "No" }).click();
    await page.getByRole("button", { name: "Next" }).click();

    // Lifestyle factors — optional, then submit.
    await page.getByRole("button", { name: "Submit" }).click();

    await expect(page.getByText("Your assessment has been submitted")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/not a medical diagnosis/i)).toBeVisible();
  });

  test("shows a validation-blocked Next button until age is entered", async ({ page }) => {
    await page.goto("/login/patient");
    await page.getByLabel("Email").fill(TEST_PATIENT_EMAIL);
    await page.getByLabel("Password").fill(TEST_PATIENT_PASSWORD);
    await page.getByRole("button", { name: "Sign in" }).click();
    await page.goto("/assessment/new");

    await expect(page.getByRole("button", { name: "Next" })).toBeDisabled();
    await page.getByPlaceholder("e.g. 34").fill("40");
    await expect(page.getByRole("button", { name: "Next" })).toBeEnabled();
  });
});
