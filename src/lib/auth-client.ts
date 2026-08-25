"use client";

import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import { TWO_FACTOR_CLIENT_PAGE } from "@/lib/two-factor-policy";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      twoFactorPage: TWO_FACTOR_CLIENT_PAGE,
    }),
  ],
});
