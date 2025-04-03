import { getServerSession } from 'next-auth';
import { authOptions } from '../api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';
import InboxClient from '@/components/InboxClient';
import prisma from '@/lib/prisma';
import { InboxEntry, Action } from '@/types';

export default async function InboxPage() {
  const session = await getServerSession(authOptions);

  if (!session || !session.user) {
    redirect('/api/auth/signin');
  }

  // Fetch inbox entries for the current user
  const rawEntries = await prisma.inboxEntry.findMany({
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

  // Transform the raw entries to match the expected InboxEntry type
  const entries: InboxEntry[] = rawEntries.map(entry => ({
    ...entry,
    actions: entry.actions.map(action => ({
      ...action,
      metadata: action.metadata as Action['metadata']
    }))
  }));

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">My Inbox</h1>
      <InboxClient initialEntries={entries} />
    </div>
  );
}
