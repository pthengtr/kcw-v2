import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
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
