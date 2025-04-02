/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    serverExternalPackages: ['@prisma/client', 'bcrypt'],
  },
  images: {
    domains: [
      'lh3.googleusercontent.com',
      'googleusercontent.com',
      'avatars.githubusercontent.com'
    ],
  },
};

module.exports = nextConfig;
