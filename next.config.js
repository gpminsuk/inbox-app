/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  images: {
    domains: [
      'lh3.googleusercontent.com',
      'googleusercontent.com',
      'avatars.githubusercontent.com'
    ],
  },
  allowedDevOrigins: ['http://localhost:3000', 'http://10.0.0.197:3000'],
};

module.exports = nextConfig;
