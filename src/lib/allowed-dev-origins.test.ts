import { describe, expect, it } from "vitest";
import { getAllowedDevOrigins } from "./allowed-dev-origins";

describe("getAllowedDevOrigins", () => {
  it("derives development hosts from configured public app urls", () => {
    expect(
      getAllowedDevOrigins({
        BETTER_AUTH_TRUSTED_ORIGINS:
          "http://localhost:3000,https://register-available-shaft.ngrok-free.dev/",
        BETTER_AUTH_URL: "https://register-available-shaft.ngrok-free.dev/",
        NEXT_ALLOWED_DEV_ORIGINS: "",
        NEXT_PUBLIC_APP_URL: "https://register-available-shaft.ngrok-free.dev/",
      })
    ).toEqual(["register-available-shaft.ngrok-free.dev"]);
  });

  it("keeps explicit allowed dev origins and removes duplicates", () => {
    expect(
      getAllowedDevOrigins({
        NEXT_ALLOWED_DEV_ORIGINS:
          "local-origin.dev,https://local-origin.dev,*.local-origin.dev",
        NEXT_PUBLIC_APP_URL: "https://local-origin.dev",
      })
    ).toEqual(["local-origin.dev", "*.local-origin.dev"]);
  });
});
