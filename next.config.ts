import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdfjs-dist", "@anthropic-ai/claude-agent-sdk"],
};

export default nextConfig;
