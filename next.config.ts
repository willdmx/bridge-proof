import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sas-lib", "@solana/kit"],
  poweredByHeader: false,
};
export default nextConfig;
