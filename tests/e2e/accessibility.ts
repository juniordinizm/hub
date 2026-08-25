import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import {
  formatBlockingAccessibilityViolations,
  getBlockingAccessibilityViolations,
} from "../../src/tooling/accessibility-violations";

export const assertNoBlockingAccessibilityViolations = async (
  page: Page,
  surface: string
): Promise<void> => {
  await page.locator("h1").first().waitFor({ state: "visible" });
  const results = await new AxeBuilder({ page }).analyze();
  const blockingViolations = getBlockingAccessibilityViolations(
    results.violations
  );

  if (blockingViolations.length > 0) {
    throw new Error(
      formatBlockingAccessibilityViolations(blockingViolations, surface)
    );
  }
};
