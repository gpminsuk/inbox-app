'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import Link from 'next/link';
import Image from 'next/image';
import { useState } from 'react';

export default function Header() {
  const { data: session } = useSession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <header className="bg-white shadow">
      <div className="container mx-auto px-4 py-4">
        <div className="flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-indigo-600">
            Inbox App
          </Link>
          
          <div className="hidden md:flex items-center space-x-4">
            <Link href="/" className="text-gray-700 hover:text-indigo-600">
              Home
            </Link>
            {session ? (
              <>
                <Link href="/inbox" className="text-gray-700 hover:text-indigo-600">
                  My Inbox
                </Link>
                <Link href="/settings" className="text-gray-700 hover:text-indigo-600">
                  Settings
                </Link>
                <button
                  onClick={() => signOut()}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                >
                  Sign Out
                </button>
                <div className="flex items-center">
                  {session.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt={session.user.name || 'User'}
                      className="rounded-full ml-2"
                      width={32}
                      height={32}
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center ml-2">
                      {session.user?.name?.charAt(0) || 'U'}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={() => signIn('google')}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
              >
                Sign In with Google
              </button>
            )}
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="text-gray-700 focus:outline-none"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                {isMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {isMenuOpen && (
          <div className="mt-4 md:hidden">
            <Link
              href="/"
              className="block py-2 text-gray-700 hover:text-indigo-600"
              onClick={() => setIsMenuOpen(false)}
            >
              Home
            </Link>
            {session ? (
              <>
                <Link
                  href="/inbox"
                  className="block py-2 text-gray-700 hover:text-indigo-600"
                  onClick={() => setIsMenuOpen(false)}
                >
                  My Inbox
                </Link>
                <Link
                  href="/settings"
                  className="block py-2 text-gray-700 hover:text-indigo-600"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Settings
                </Link>
                <button
                  onClick={() => {
                    signOut();
                    setIsMenuOpen(false);
                  }}
                  className="block w-full text-left py-2 text-gray-700 hover:text-indigo-600"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={() => {
                  signIn('google');
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left py-2 text-gray-700 hover:text-indigo-600"
              >
                Sign In with Google
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
