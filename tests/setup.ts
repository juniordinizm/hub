import { afterEach, beforeEach } from "vitest";
import { createHermeticTestEnvironment } from "../src/testing/hermetic-environment";

const BASE_ENVIRONMENT = createHermeticTestEnvironment(process.env);

const resetEnvironment = (): void => {
  process.env = { ...BASE_ENVIRONMENT };
};

resetEnvironment();
beforeEach(resetEnvironment);
afterEach(resetEnvironment);
