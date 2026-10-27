/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const api = process.env.API_URL;
    if (!api) return [];
    return [{ source: '/api/:path*', destination: `${api}/api/:path*` }];
  },
};

export default nextConfig;