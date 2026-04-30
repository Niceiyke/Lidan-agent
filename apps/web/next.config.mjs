/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3001/api/:path*'
      },
      {
        source: '/events/:path*',
        destination: 'http://localhost:3001/events/:path*'
      }
    ];
  }
};
export default nextConfig;
