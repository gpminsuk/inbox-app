#!/usr/bin/env ts-node

/**
 * Gmail Email Processor
 * 
 * This script fetches unread emails from connected Gmail accounts and
 * prints them to the console. It can be extended to create inbox entries.
 */

import { PrismaClient } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Define simple types for Gmail API
type GmailClient = any;
type GmailMessage = any;

const prisma = new PrismaClient();

// Log levels
type LogLevel = 'info' | 'warning' | 'error';

// Log entry type
type LogEntry = {
  message: string;
  level: LogLevel;
  userId?: string;
  timestamp: Date;
};

// Log queue to store logs before writing to database
class LogQueue {
  private queue: LogEntry[] = [];
  private processing = false;
  private flushPromise: Promise<void> = Promise.resolve();

  // Add a log to the queue
  add(entry: LogEntry): void {
    this.queue.push(entry);

    // Start processing if not already in progress
    if (!this.processing) {
      this.process();
    }
  }

  // Process logs in the queue
  private async process(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;

    try {
      // Take the next log from the queue
      const entry = this.queue.shift();
      if (!entry) {
        this.processing = false;
        return;
      }

      // Write to database
      await prisma.log.create({
        data: {
          message: entry.message,
          level: entry.level,
          source: 'email-processor',
          timestamp: entry.timestamp,
          userId: entry.userId || null
        }
      });
    } catch (error) {
      console.error(`Failed to save log to database: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      this.processing = false;

      // Continue processing if there are more logs
      if (this.queue.length > 0) {
        this.process();
      }
    }
  }

  // Flush all logs and wait for completion
  async flush(): Promise<void> {
    // If already flushing, return the existing promise
    if (this.processing) {
      // Wait for current processing to complete and then flush again
      return this.flushPromise.then(() => this.flush());
    }

    // If queue is empty, return resolved promise
    if (this.queue.length === 0) {
      return Promise.resolve();
    }

    // Create a new flush promise
    this.flushPromise = new Promise<void>(async (resolve) => {
      // Process all remaining logs
      while (this.queue.length > 0) {
        this.processing = true;
        try {
          const entries = [...this.queue];
          this.queue = [];

          // Batch insert logs
          await prisma.log.createMany({
            data: entries.map(entry => ({
              message: entry.message,
              level: entry.level,
              source: 'email-processor',
              timestamp: entry.timestamp,
              userId: entry.userId || null
            }))
          });
        } catch (error) {
          console.error(`Failed to flush logs to database: ${error instanceof Error ? error.message : String(error)}`);
        } finally {
          this.processing = false;
        }
      }
      resolve();
    });

    return this.flushPromise;
  }
}

// Create a global log queue
const logQueue = new LogQueue();

// Helper function to log messages to console and queue for database
function log(message: string, level: LogLevel = 'info', userId?: string): void {
  const timestamp = new Date();
  const logMessage = `${timestamp.toISOString()} - ${message}`;

  // Log to console immediately
  console.log(logMessage);

  // Add to queue for database logging
  logQueue.add({
    message,
    level,
    userId,
    timestamp
  });
}

// Function to get Gmail API client for a user
async function getGmailClient(refreshToken: string | null, accessToken: string | null, permissionLevel: string = 'read-only'): Promise<GmailClient> {
  if (!refreshToken && !accessToken) {
    throw new Error('No refresh token or access token available');
  }

  try {
    // Dynamic import to avoid TypeScript errors
    const { google } = require('googleapis');

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI,
    );

    oauth2Client.setCredentials({
      refresh_token: refreshToken || undefined,
      access_token: accessToken || undefined,
    });

    // Log the permission level
    log(`Using Gmail API with ${permissionLevel} permissions`);

    return google.gmail({ version: 'v1', auth: oauth2Client });
  } catch (error) {
    log(`Error getting Gmail client: ${error instanceof Error ? error.message : String(error)}`, 'error');
    throw error;
  }
}

// Function to fetch unread emails
async function fetchUnreadEmails(gmail: GmailClient, maxResults: number = 10): Promise<GmailMessage[]> {
  try {
    // Only fetch unread emails
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread', // Only fetch unread emails
      maxResults: maxResults,
    });

    // If no unread emails, return empty array
    if (!response.data.messages || response.data.messages.length === 0) {
      log('No unread messages found.');
      return [];
    }

    const emails: GmailMessage[] = [];

    // Fetch full details for each email
    for (const message of response.data.messages) {
      const messageId = message.id;
      if (!messageId) {
        log('No message ID found for one of the emails.');
        continue;
      }

      try {
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
          format: 'full',
        });

        emails.push(email.data);
      } catch (error) {
        log(`Error fetching email ${messageId}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }

    return emails;
  } catch (error) {
    log(`Error fetching unread emails: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return [];
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
      log(`Failed to parse Gemini response as JSON: ${parseError instanceof Error ? parseError.message : String(parseError)}`, 'error');
    }
  } catch (error) {
    log(`Failed to generate Gemini response: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
  return [];
}

// Function to create an inbox entry from an email
async function createInboxEntry(
  userId: string,
  email: ReturnType<typeof parseEmail>,
  suggestedActions: string[],
  canModifyEmails: boolean
): Promise<void> {
  try {
    // Create the inbox entry
    const inboxEntry = await prisma.inboxEntry.create({
      data: {
        title: email.subject,
        content: email.body,
        userId: userId,
        actions: {
          create: suggestedActions.map(action => ({
            description: action,
            completed: false
          }))
        }
      }
    });

    log(`Created inbox entry: ${inboxEntry.id}`);
  } catch (error) {
    log(`Error creating inbox entry: ${error instanceof Error ? error.message : String(error)}`, 'error');
  }
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

    let totalProcessedEmails = 0;

    for (const account of accounts) {
      try {
        log(`Processing emails for user: ${account.user.email || account.user.id}`);

        // Get Gmail client with permission level
        const gmail = await getGmailClient(
          account.refresh_token,
          account.access_token,
          account.user.emailPermissionLevel
        );

        // Fetch only unread emails
        const emails = await fetchUnreadEmails(gmail);

        if (emails.length > 0) {
          log(`Found ${emails.length} unread emails for user: ${account.user.email || account.user.id}`);

          for (const email of emails) {
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
            for (let index = 0; index < suggestedActions.length; index++) {
              const action = suggestedActions[index];
              log(`  ${index + 1}. ${action}`);
            }
            log('----------------------------------------');

            // Create inbox entry
            await createInboxEntry(
              account.user.id,
              parsedEmail,
              suggestedActions,
              account.user.emailPermissionLevel === 'modify-compose'
            );

            totalProcessedEmails++;
          }
        } else {
          log(`No unread emails found for user: ${account.user.email || account.user.id}`);
        }
      } catch (error) {
        log(`Error processing emails for user ${account.user.id}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }

    if (totalProcessedEmails === 0) {
      log('No new emails to process.');
    } else {
      log(`Processed ${totalProcessedEmails} unread emails.`);
    }

    log('Email processing job completed.');
  } catch (error) {
    log(`Error in email processing job: ${error instanceof Error ? error.message : String(error)}`, 'error');
  } finally {
    await prisma.$disconnect();
  }
}

// Run the main function
main().catch(async error => {
  log(`Unhandled error: ${error instanceof Error ? error.message : String(error)}`, 'error');

  // Ensure all logs are written before exiting
  try {
    await logQueue.flush();
  } catch (err) {
    console.error('Error flushing logs:', err);
  }

  process.exit(1);
});

// Ensure all logs are flushed before the script exits
process.on('beforeExit', async () => {
  try {
    await logQueue.flush();
  } catch (err) {
    console.error('Error flushing logs:', err);
  }
});
