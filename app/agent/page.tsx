import { Metadata } from 'next';
import AgentClient from '@/components/AgentClient';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: 'Agent Activity | Inbox App',
  description: 'View the activity logs of the email processing agent',
};

export default async function AgentPage() {
  // Check if user is authenticated
  const session = await getServerSession(authOptions);
  
  if (!session?.user) {
    redirect('/auth/signin');
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Agent Activity</h1>
      <AgentClient />
    </div>
  );
}
