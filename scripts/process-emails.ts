#!/usr/bin/env ts-node

/**
 * Gmail Email Processor
 * 
 * This script fetches the topmost email from connected Gmail accounts and
 * prints them to the console. It can be extended to create inbox entries.
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define simple types for Gmail API
type GmailClient = any;
type GmailMessage = any;

const prisma = new PrismaClient();
const logDir = path.join(__dirname, '../logs');

// Ensure log directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Create log file with timestamp
const logFile = path.join(logDir, `email-process-${new Date().toISOString().replace(/:/g, '-')}.log`);
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

// Helper function to log messages both to console and file
function log(message: string): void {
  const timestamp = new Date().toISOString();
  const logMessage = `${timestamp} - ${message}`;
  console.log(logMessage);
  logStream.write(logMessage + '\n');
}

// Function to get Gmail API client for a user
async function getGmailClient(refreshToken: string | null, accessToken: string | null): Promise<GmailClient> {
  if (!refreshToken && !accessToken) {
    throw new Error('No refresh token or access token available');
  }

  try {
    // Dynamic import to avoid TypeScript errors
    const { google } = require('googleapis');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `${process.env.NEXTAUTH_URL}/api/auth/callback/google`
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken || undefined,
      access_token: accessToken || undefined,
    });

    return google.gmail({ version: 'v1', auth: oauth2Client });
  } catch (error) {
    log(`Error creating Gmail client: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}

// Function to fetch the topmost email
async function fetchTopmostEmail(gmail: GmailClient): Promise<GmailMessage | null> {
  try {
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 1, // Get only the topmost email
    });

    if (!response.data.messages || response.data.messages.length === 0) {
      log('No messages found.');
      return null;
    }

    const messageId = response.data.messages[0].id;
    if (!messageId) {
      log('No message ID found.');
      return null;
    }

    const email = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    return email.data;
  } catch (error) {
    log(`Error fetching topmost email: ${error instanceof Error ? error.message : String(error)}`);
    return null;
  }
}

// Function to parse email data
function parseEmail(email: GmailMessage): {
  subject: string;
  from: string;
  date: string;
  body: string;
  messageId: string;
  threadId: string;
  isUnread: boolean;
} {
  const headers = email.payload?.headers || [];
  const subject = headers.find((h: { name: string; value: string }) => h.name === 'Subject')?.value || 'No Subject';
  const from = headers.find((h: { name: string; value: string }) => h.name === 'From')?.value || 'Unknown Sender';
  const date = headers.find((h: { name: string; value: string }) => h.name === 'Date')?.value || new Date().toISOString();

  // Check if email is unread by looking for the UNREAD label
  const isUnread = email.labelIds?.includes('UNREAD') || false;

  // Get email body
  let body = '';
  if (email.payload?.parts && email.payload.parts.length > 0) {
    // Try to find text/plain part
    const textPart = email.payload.parts.find((part: { mimeType: string; body?: { data: string } }) => part.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    } else if (email.payload.parts[0]?.body?.data) {
      // Fallback to first part
      body = Buffer.from(email.payload.parts[0].body.data, 'base64').toString('utf-8');
    }
  } else if (email.payload?.body?.data) {
    // Single part email
    body = Buffer.from(email.payload.body.data, 'base64').toString('utf-8');
  }

  return {
    subject,
    from,
    date,
    body,
    messageId: email.id || '',
    threadId: email.threadId || '',
    isUnread
  };
}

// Define interfaces for Gemini API response
interface GeminiContentPart {
  text: string;
}

interface GeminiContent {
  parts: GeminiContentPart[];
}

interface GeminiCandidate {
  content: GeminiContent;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
}

// Function to get suggested actions from Gemini
async function getSuggestedActions(subject: string, body: string): Promise<string[]> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      log('Gemini API key not found. Skipping action suggestions.');
      return ['Reply to email', 'Archive email'];
    }

    // Extract text content from HTML if needed
    let cleanBody = body;
    if (body.includes('<html') || body.includes('<div')) {
      // Very simple HTML stripping - in production, use a proper HTML parser
      cleanBody = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Limit content length to avoid token limits
    const truncatedBody = cleanBody.substring(0, 1500);

    // Create the prompt
    const prompt = `You are an AI assistant that analyzes emails and suggests potential actions.
                
Email Subject: ${subject}

Email Body: ${truncatedBody}

Based on this email content, provide 3-5 specific, actionable tasks in order of priority. Focus on concrete actions like scheduling meetings, responding with specific information, following up on deadlines, etc.

IMPORTANT: Return your response ONLY as a valid JSON array of strings, with each string being a suggested action. For example:
["Reply to confirm attendance", "Schedule meeting in calendar", "Prepare presentation slides"]`;

    // Generate content with structured format
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.STRING,
          },
        },
      },
    });
    try {
      if (response.text) {
        return JSON.parse(response.text);
      }
    } catch (parseError) {
      // If JSON parsing fails, fall back to text splitting
      log(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }
  } catch (error) {
    log(`Failed to generate Gemini response: ${error instanceof Error ? error.message : String(error)}`);
  }
  return [];
}

// Main function
async function main(): Promise<void> {
  try {
    log('Starting email processing job...');

    // Get all accounts
    const accounts = await prisma.account.findMany({
      where: {
        provider: 'google',
      },
      include: {
        user: true,
      },
    });

    log(`Found ${accounts.length} Google accounts.`);

    for (const account of accounts) {
      try {
        log(`Processing emails for user: ${account.user.email || account.user.id}`);

        // Get Gmail client
        const gmail = await getGmailClient(account.refresh_token, account.access_token);

        // Fetch topmost email
        const email = await fetchTopmostEmail(gmail);

        if (email) {
          const parsedEmail = parseEmail(email);

          // Get suggested actions from Gemini
          const suggestedActions = await getSuggestedActions(parsedEmail.subject, parsedEmail.body);

          // Print email details
          log('----------------------------------------');
          log(`User: ${account.user.email || account.user.id}`);
          log(`Subject: ${parsedEmail.subject}`);
          log(`From: ${parsedEmail.from}`);
          log(`Date: ${parsedEmail.date}`);
          log(`Status: ${parsedEmail.isUnread ? 'UNREAD' : 'READ'}`);
          log(`Body: ${parsedEmail.body.substring(0, 200)}${parsedEmail.body.length > 200 ? '...' : ''}`);
          log('Suggested Actions:');
          suggestedActions.forEach((action, index) => {
            log(`  ${index + 1}. ${action}`);
          });
          log('----------------------------------------');

          // Here you could add code to create an inbox entry if needed
        } else {
          log(`No emails found for user: ${account.user.email || account.user.id}`);
        }
      } catch (error) {
        log(`Error processing emails for user ${account.user.id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    log('Email processing job completed.');
  } catch (error) {
    log(`Error in email processing job: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    await prisma.$disconnect();
    logStream.end();
  }
}

// Run the main function
main().catch(error => {
  log(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
