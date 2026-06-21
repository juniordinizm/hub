import type { NextConfig } from "next";
import { getAllowedDevOrigins } from "./src/lib/allowed-dev-origins";

const allowedDevOrigins = getAllowedDevOrigins(process.env);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  reactCompiler: true,
};

export default nextConfig;
