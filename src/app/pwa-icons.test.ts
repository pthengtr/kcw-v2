import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import manifest from "@/app/manifest";

const ROOT = process.cwd();

function read(rel: string) {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

describe("PWA install icons", () => {
  it("ships KCW logo icons for Chrome Add to Home Screen", () => {
    for (const rel of [
      "public/icons/icon-192.png",
      "public/icons/icon-512.png",
      "public/icons/icon-maskable-192.png",
      "public/icons/icon-maskable-512.png",
      "public/icons/apple-touch-icon.png",
      "src/app/icon.png",
      "src/app/apple-icon.png",
    ]) {
      expect(fs.existsSync(path.join(ROOT, rel))).toBe(true);
    }
  });

  it("exposes a web app manifest with KCW branding and install icons", () => {
    const data = manifest();
    expect(data.name).toBe("KCW V2");
    expect(data.short_name).toBe("KCW");
    expect(data.start_url).toBe("/home");
    expect(data.display).toBe("standalone");
    expect(data.icons?.some((icon) => icon.src === "/icons/icon-192.png")).toBe(
      true
    );
    expect(data.icons?.some((icon) => icon.src === "/icons/icon-512.png")).toBe(
      true
    );
    expect(
      data.icons?.some(
        (icon) =>
          icon.src === "/icons/icon-maskable-512.png" &&
          icon.purpose === "maskable"
      )
    ).toBe(true);
  });

  it("declares apple web app metadata for mobile install", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toContain("appleWebApp");
    expect(layout).toContain("/icons/apple-touch-icon.png");
    expect(layout).toContain('themeColor: "#2563eb"');
    expect(layout).toContain("ServiceWorkerRegister");
    expect(layout).toContain('manifest: "/manifest.webmanifest"');
  });

  it("keeps manifest and service worker reachable without auth redirect", () => {
    const middleware = read("src/middleware.ts");
    const session = read("src/lib/supabase/middleware.tsx");
    const sw = read("public/sw.js");
    const register = read("src/components/pwa/ServiceWorkerRegister.tsx");

    expect(middleware.includes("webmanifest")).toBe(true);
    expect(middleware.includes("sw")).toBe(true);
    expect(session).toContain("/manifest.webmanifest");
    expect(session).toContain("/sw.js");
    expect(session).toContain("isPublicPath");
    expect(sw).toContain('addEventListener("fetch"');
    expect(register).toContain('register("/sw.js"');
  });
});
