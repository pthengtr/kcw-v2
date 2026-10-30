import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["exceljs"],
  async redirects() {
    return [
      {
        source: "/reminder",
        destination: "/home",
        permanent: false,
      },
      {
        source: "/reminder/:path*",
        destination: "/home",
        permanent: false,
      },
    ];
  },
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
