import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';
import InboxClient from '@/components/InboxClient';
import prisma from '@/lib/prisma';

export default async function InboxPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/api/auth/signin');
  }

  // Fetch inbox entries for the current user
  const entries = await prisma.inboxEntry.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      actions: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">My Inbox</h1>
      <InboxClient initialEntries={entries} />
    </div>
  );
}
