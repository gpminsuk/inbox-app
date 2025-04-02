import { getServerSession } from 'next-auth';
import { authOptions } from './api/auth/[...nextauth]/options';
import Link from 'next/link';

export default async function Home() {
  const session = await getServerSession(authOptions);

  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Welcome to Inbox App</h1>
        <p className="text-xl text-gray-600">
          A modern inbox application that automatically processes your emails and helps you organize your tasks.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Automated Email Processing</h2>
          <p className="text-gray-600 mb-4">
            Connect your Gmail account and let our system automatically process your emails into actionable inbox entries.
          </p>
          {session ? (
            <Link 
              href="/inbox" 
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
            >
              Go to My Inbox
            </Link>
          ) : (
            <div className="text-gray-500 italic">Sign in to access your inbox</div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Gmail Integration</h2>
          <p className="text-gray-600 mb-4">
            Connect your Gmail account to automatically import emails and create actionable items from them.
          </p>
          {session ? (
            <Link 
              href="/settings" 
              className="inline-block px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
            >
              Configure Gmail
            </Link>
          ) : (
            <div className="text-gray-500 italic">Sign in to connect Gmail</div>
          )}
        </div>
      </div>

      {!session && (
        <div className="text-center">
          <Link 
            href="/api/auth/signin"
            className="inline-block px-8 py-4 bg-indigo-600 text-white text-lg font-medium rounded-md hover:bg-indigo-700 transition"
          >
            Get Started - Sign In
          </Link>
        </div>
      )}

      <div className="mt-16 border-t border-gray-200 pt-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">How It Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-5 rounded-lg shadow-sm">
            <div className="text-indigo-600 text-xl font-bold mb-2">1. Connect Gmail</div>
            <p className="text-gray-600">Connect your Gmail account in the settings page to enable email processing.</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm">
            <div className="text-indigo-600 text-xl font-bold mb-2">2. Automatic Processing</div>
            <p className="text-gray-600">Our system automatically checks for new emails and creates inbox entries with actions.</p>
          </div>
          <div className="bg-white p-5 rounded-lg shadow-sm">
            <div className="text-indigo-600 text-xl font-bold mb-2">3. Manage Actions</div>
            <p className="text-gray-600">Track actions associated with each entry, mark them as complete, and stay organized.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
