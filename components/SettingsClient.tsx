'use client';

import { useState } from 'react';
import Image from 'next/image';
import { signInWithDefaultScope, signInWithGmailScope } from '@/lib/auth-utils';

type Account = {
  id: string;
  provider: string;
  providerAccountId: string;
};

type User = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  emailPermissionLevel?: string;
  accounts: Account[];
};

interface SettingsClientProps {
  user: User | null;
  hasGoogleAccount: boolean;
}

export default function SettingsClient({ user, hasGoogleAccount }: SettingsClientProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [permissionLevel] = useState(user?.emailPermissionLevel || 'read-only');

  const handleConnectGmail = async () => {
    setIsConnecting(true);
    try {
      await signInWithDefaultScope('/settings');
    } catch (error) {
      console.error('Error connecting Gmail:', error);
      setIsConnecting(false);
    }
  };

  const handleUpgradePermissions = async () => {
    if (!user) return;

    setIsUpgrading(true);
    try {
      // Sign in with Google using the higher permission scope
      await signInWithGmailScope('/settings');
    } catch (error) {
      console.error('Error upgrading permissions:', error);
      setIsUpgrading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-6">Account Settings</h2>

      <div className="mb-8">
        <h3 className="text-lg font-medium text-gray-700 mb-3">Profile Information</h3>
        <div className="flex items-center space-x-4">
          {user?.image ? (
            <Image
              src={user.image}
              alt={user.name || 'User'}
              className="rounded-full"
              width={64}
              height={64}
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xl font-semibold">
              {user?.name?.charAt(0) || 'U'}
            </div>
          )}
          <div>
            <div className="text-gray-800 font-medium">{user?.name || 'User'}</div>
            <div className="text-gray-500">{user?.email || 'No email'}</div>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium text-gray-700 mb-3">Connected Accounts</h3>

        <div className="bg-gray-50 p-4 rounded-lg mb-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                <path d="M20.283 10.356h-8.327v3.451h4.792c-.446 2.193-2.313 3.453-4.792 3.453a5.27 5.27 0 0 1-5.279-5.28 5.27 5.27 0 0 1 5.279-5.279c1.259 0 2.397.447 3.29 1.178l2.6-2.599c-1.584-1.381-3.615-2.233-5.89-2.233a8.908 8.908 0 0 0-8.934 8.934 8.907 8.907 0 0 0 8.934 8.934c4.467 0 8.529-3.249 8.529-8.934 0-.528-.081-1.097-.202-1.625z"></path>
              </svg>
              <div>
                <div className="font-medium">Google / Gmail</div>
                <div className="text-sm text-gray-500">
                  {hasGoogleAccount
                    ? 'Connected'
                    : 'Connect to import emails from Gmail'}
                </div>
              </div>
            </div>

            {hasGoogleAccount ? (
              <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                Connected
              </span>
            ) : (
              <button
                onClick={handleConnectGmail}
                disabled={isConnecting}
                className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isConnecting ? 'Connecting...' : 'Connect'}
              </button>
            )}
          </div>
        </div>

        {hasGoogleAccount && (
          <div className="bg-gray-50 p-4 rounded-lg mb-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium">Gmail Permission Level</div>
                <div className="text-sm text-gray-500">
                  {permissionLevel === 'read-only'
                    ? 'Currently read-only (can only read emails)'
                    : 'Full access (can mark emails as read and compose drafts)'}
                </div>
              </div>

              {permissionLevel === 'read-only' ? (
                <button
                  onClick={handleUpgradePermissions}
                  disabled={isUpgrading}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isUpgrading ? 'Upgrading...' : 'Upgrade Permissions'}
                </button>
              ) : (
                <span className="px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full">
                  Full Access
                </span>
              )}
            </div>
          </div>
        )}

        <div className="text-sm text-gray-500 mt-4">
          <p>
            Connecting your Gmail account allows Inbox App to import your emails and create actionable items from them.
          </p>
          {hasGoogleAccount && (
            <p className="mt-2">
              <strong>Permission levels:</strong><br />
              - Read-only: Inbox App can only read your emails to create inbox entries<br />
              - Full access: Inbox App can read emails, mark them as read, and compose draft emails
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
