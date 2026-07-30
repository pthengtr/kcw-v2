import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  outputFileTracingIncludes: {
    "/api/bank/match": [
      "./prompts/bank-statement-match-7236.md",
      "./prompts/bank-statement-match-3557.md",
      "./prompts/bank-statement-match-0393.md",
      "./prompts/bank-statement-match-4759.md",
      "./prompts/bank-statement-match-1139.md",
      "./prompts/bank-statement-match-6184.md",
    ],
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
