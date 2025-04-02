'use client';

import { useState } from 'react';
import Link from 'next/link';
import { signInWithDefaultScope } from '@/lib/auth-utils';

export default function SignInClient() {
  const [isSigningIn, setIsSigningIn] = useState(false);

  const handleSignIn = async () => {
    setIsSigningIn(true);
    try {
      signInWithDefaultScope('/');
    } catch (error) {
      console.error('Error signing in:', error);
      setIsSigningIn(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-8">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Welcome to Inbox App</h2>
        <p className="text-gray-600">
          Sign in to access your inbox and manage your tasks
        </p>
      </div>

      <button
        onClick={() => handleSignIn()}
        disabled={isSigningIn}
        className="w-full flex items-center justify-center space-x-2 bg-white border border-gray-300 rounded-md py-3 px-4 hover:bg-gray-50 mb-4"
      >
        <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
          <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z"></path>
        </svg>
        <span className="text-gray-700 font-medium">
          {isSigningIn ? 'Signing in...' : 'Sign in with Google'}
        </span>
      </button>

      <div className="text-center mt-6">
        <p className="text-sm text-gray-500">
          By signing in, you agree to our{' '}
          <Link href="/terms" className="text-indigo-600 hover:text-indigo-800">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-indigo-600 hover:text-indigo-800">
            Privacy Policy
          </Link>
        </p>
      </div>
    </div>
  );
}
