import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';
import SettingsClient from '@/components/SettingsClient';
import prisma from '@/lib/prisma';

export default async function SettingsPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/api/auth/signin');
  }

  // Get user data with accounts
  const user = await prisma.user.findUnique({
    where: {
      id: session.user.id,
    },
    include: {
      accounts: true,
    },
  });

  // Check if user has a Google account connected
  const hasGoogleAccount = user?.accounts.some(
    (account: { provider: string }) => account.provider === 'google'
  );

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">Settings</h1>
      <SettingsClient user={user} hasGoogleAccount={!!hasGoogleAccount} />
    </div>
  );
}
