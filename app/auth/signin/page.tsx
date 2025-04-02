import { getServerSession } from 'next-auth';
import { authOptions } from '../../api/auth/[...nextauth]/options';
import { redirect } from 'next/navigation';
import SignInClient from '@/components/SignInClient';

export default async function SignInPage() {
  const session = await getServerSession(authOptions);

  // If user is already signed in, redirect to home page
  if (session) {
    redirect('/');
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Sign In</h1>
      <SignInClient />
    </div>
  );
}
