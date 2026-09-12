/** @type {import('next').NextConfig} */
const nextConfig = {
  // Permite carregar imagens/assets do Supabase Storage e Vercel Blob em produção
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/**",
      },
      {
        protocol: "https",
        hostname: "*.public.blob.vercel-storage.com",
      },
    ],
  },
  // Garante que o Prisma Client rode corretamente no ambiente serverless do Vercel
  // (Next.js 14 — no Next.js 15+ isso virou `serverExternalPackages` top-level)
  experimental: {
    serverComponentsExternalPackages: ["@prisma/client", "prisma"],
  },
  async redirects() {
    return [
      {
        source: "/app",
        destination: "/painel",
        permanent: true,
      },
      {
        source: "/app/:path*",
        destination: "/painel/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
