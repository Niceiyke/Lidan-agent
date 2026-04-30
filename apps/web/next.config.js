/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:4333/api/:path*'
      },
      {
        source: '/events/:path*',
        destination: 'http://localhost:4333/events/:path*'
      }
    ];
  }
};
export default nextConfig;
