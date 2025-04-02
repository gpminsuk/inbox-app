import { PrismaAdapter } from "@auth/prisma-adapter";
import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import prisma from "@/lib/prisma";

// Extend the Session type to include id in the user object
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    }
  }
}

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  providers: [
    GoogleProvider({
      id: 'google',
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "consent",
          access_type: "offline",
          response_type: "code",
          redirect_uri: process.env.GOOGLE_REDIRECT_URI,
        }
      }
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!!account && user?.id) {
        try {
          // Check if this is an upgrade request by examining the account scope
          const isUpgradeRequest = account.scope?.includes('gmail.modify');

          if (isUpgradeRequest) {
            // Update the user's permission level in the database
            await prisma.user.update({
              where: { id: user.id },
              data: { emailPermissionLevel: 'modify-compose' },
            });
            console.log(`Upgraded permissions for user ${user.id} to modify-compose`);
          }
        } catch (error) {
          console.error('Error handling user permission level:', error);
        }
      }
      return true;
    },
    session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
  secret: process.env.NEXTAUTH_SECRET,
};
