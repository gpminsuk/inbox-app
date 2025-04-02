'use client';

import { signIn } from 'next-auth/react';

/**
 * Sign in with default scope (read-only access to Gmail)
 * @param callbackUrl URL to redirect to after successful sign-in
 * @returns Promise from the signIn function
 */
export const signInWithDefaultScope = (callbackUrl: string = '/') => {
  return signIn('google', {
    callbackUrl,
    redirect: true,
  }, {
    scope: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.readonly"
  });
};

/**
 * Sign in with expanded Gmail scope (read, modify, and compose)
 * @param callbackUrl URL to redirect to after successful sign-in
 * @returns Promise from the signIn function
 */
export const signInWithGmailScope = (callbackUrl: string = '/settings') => {
  return signIn('google', {
    callbackUrl,
    redirect: true,
  }, {
    scope: "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.compose"
  });
};
