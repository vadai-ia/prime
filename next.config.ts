import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf carga su build de pdf.js con import dinámico: que lo resuelva Node, no el bundler
  serverExternalPackages: ["unpdf"],
};

export default nextConfig;
