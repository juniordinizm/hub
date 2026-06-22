import type { NextConfig } from "next";
import { getAllowedDevOrigins } from "./src/lib/allowed-dev-origins";

const allowedDevOrigins = getAllowedDevOrigins(process.env);

const nextConfig: NextConfig = {
  ...(allowedDevOrigins?.length ? { allowedDevOrigins } : {}),
  images: {
    remotePatterns: [
      {
        hostname: "cdn.vod.br1.jmvstream.com",
        pathname: "/vod/**",
        protocol: "https",
      },
    ],
  },
  reactCompiler: true,
};

export default nextConfig;
