import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
    outputFileTracingIncludes: {
      "/api/bank/match": ["./prompts/bank-statement-match-7236.md"],
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "jdzitzsucntqbjvwiwxm.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/pictures/public/**",
      },
      {
        protocol: "https",
        hostname: "jdzitzsucntqbjvwiwxm.supabase.co",
        pathname: "/storage/v1/object/public/pictures/product/**",
      },
    ],
  },
};

export default nextConfig;
