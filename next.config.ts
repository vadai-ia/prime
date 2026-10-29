import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // unpdf carga su build de pdf.js con import dinámico y mammoth (Word) es CommonJS: que los resuelva Node, no el bundler
  serverExternalPackages: ["unpdf", "mammoth"],
  experimental: {
    // El descriptivo de puesto (PDF o Word, hasta 4 MB) llega por acción del servidor (actions/intakes.ts).
    serverActions: { bodySizeLimit: "5mb" },
  },
};

export default nextConfig;
