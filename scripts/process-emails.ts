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

// Function to fetch the latest email timestamp
async function getLatestEmailTimestamp(gmail: GmailClient): Promise<Date | null> {
  try {
    // Fetch the most recent email
    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 1,
    });

    // If no emails, return null
    if (!response.data.messages || response.data.messages.length === 0) {
      log('No emails found.');
      return null;
    }

    // Get the message ID
    const messageId = response.data.messages[0].id;
    if (!messageId) {
      log('No message ID found for the latest email.');
      return null;
    }

    // Get full email data
    const email = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
    });

    // Extract the timestamp
    if (email.data.internalDate) {
      const timestamp = new Date(parseInt(email.data.internalDate));
      log(`Latest email timestamp: ${timestamp.toISOString()}`);
      return timestamp;
    }

    return null;
  } catch (error) {
    log(`Error fetching latest email timestamp: ${error instanceof Error ? error.message : String(error)}`, 'error');
    return null;
  }
}

// Function to fetch emails received after a specific timestamp
async function fetchRecentEmails(gmail: GmailClient, afterTimestamp: Date | null, maxResults: number = 10): Promise<GmailMessage[]> {
  try {
    // If no timestamp, return empty array
    if (!afterTimestamp) {
      log('No previous timestamp found. Skipping email processing for this run.');
      return [];
    }

    // Convert to seconds for Gmail API (which uses seconds, not milliseconds)
    const afterSeconds = Math.floor(afterTimestamp.getTime() / 1000);
    log(`Fetching emails after timestamp: ${afterTimestamp.toISOString()} (${afterSeconds}s)`);

    const response = await gmail.users.messages.list({
      userId: 'me',
      maxResults: 50, // Request more than we need since we'll filter
      q: `after:${afterSeconds}`,
    });

    // If no emails, return empty array
    if (!response.data.messages || response.data.messages.length === 0) {
      log('No messages found in the date range.');
      return [];
    }

    // Fetch full email details and filter by timestamp
    const emails: GmailMessage[] = [];
    for (const message of response.data.messages) {
      const messageId = message.id;
      if (!messageId) {
        log('No message ID found for one of the emails.');
        continue;
      }

      try {
        // Get full email data
        const email = await gmail.users.messages.get({
          userId: 'me',
          id: messageId,
        });

        // Skip messages with internalDate smaller than afterTimestamp
        if (email.data.internalDate) {
          const emailTimestamp = parseInt(email.data.internalDate);
          const afterTimestampMs = afterTimestamp.getTime();

          if (emailTimestamp <= afterTimestampMs) {
            log(`Skipping email with timestamp ${new Date(emailTimestamp).toISOString()} - older than or equal to last processed`);
            continue;
          }

          // Include the email since it's newer than our timestamp
          emails.push(email.data);
          log(`Including email with timestamp ${new Date(emailTimestamp).toISOString()}`);
        } else {
          // If no timestamp, include it anyway
          emails.push(email.data);
          log(`Including email with unknown timestamp`);
        }

        // Stop if we have enough emails
        if (emails.length >= maxResults) {
          log(`Reached maximum number of emails to process (${maxResults})`);
          break;
        }
      } catch (error) {
        log(`Error fetching email ${messageId}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }

    return emails.sort((a, b) => {
      // Sort by internalDate (timestamp) in ascending order
      const dateA = a.internalDate ? parseInt(a.internalDate) : 0;
      const dateB = b.internalDate ? parseInt(b.internalDate) : 0;
      return dateA - dateB;
    });
  } catch (error) {
    log(`Error fetching emails: ${error instanceof Error ? error.message : String(error)}`, 'error');
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
async function getSuggestedActions(subject: string, body: string, userId: string): Promise<string[]> {
  try {
    if (!process.env.GEMINI_API_KEY) {
      log('Gemini API key not found. Skipping action suggestions.');
      return [];
    }

    // Fetch the user's information including name, email, and custom agent prompt
    let customAgentPrompt = '';
    let userInfo = '';
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          name: true,
          email: true,
          customAgentPrompt: true
        }
      });

      if (user) {
        // Add user's name and email to the prompt if available
        if (user.name || user.email) {
          userInfo = `\nUser Information:`;
          if (user.name) userInfo += `\nName: ${user.name}`;
          if (user.email) userInfo += `\nEmail: ${user.email}`;
        }

        if (user.customAgentPrompt) {
          customAgentPrompt = user.customAgentPrompt;
          log(`Using custom agent prompt for user ${userId}`);
        }
      }
    } catch (error) {
      log(`Error fetching user information: ${error instanceof Error ? error.message : String(error)}`, 'warning', userId);
    }

    // Extract text content from HTML if needed
    let cleanBody = body;
    if (body.includes('<html') || body.includes('<div')) {
      // Very simple HTML stripping - in production, use a proper HTML parser
      cleanBody = body.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    }

    // Limit content length to avoid token limits
    const truncatedBody = cleanBody.substring(0, 1500);

    // Add user information and custom instructions if available
    const additionalInfo = [userInfo, customAgentPrompt]
      .filter(Boolean)
      .join('\n\n');

    const customInstructions = additionalInfo
      ? `\n\nAdditional Information: ${additionalInfo}`
      : '';

    // Create the prompt
    const prompt = `You are an intelligent email triage assistant.

Your task is to analyze the email content and suggest useful actions that you can take on behalf of the user.

You can perform:
- Web browsing (no access to login credentials)
- Unsubscribing from emails (if unsubscribe option is available in the email)
- Interacting with links or buttons (only if no login is required)

Rules:
- Use your judgment to determine if the email contains anything valuable or actionable.
- If the email is not useful or requires credentials you don’t have, respond with no actions.
- Prioritize clarity, relevance, and user value.

Custom Instructions:
${customInstructions}

Email Subject: ${subject}
Email Body: ${truncatedBody}

Output Format:
Return only a valid JSON array of strings.
Each string must be a specific and concise action you suggest performing.`;

    log(`Prompt: ${prompt}`);

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
        emailId: email.messageId, // Save the Gmail message ID
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

        // If no previous timestamp, just get and store the latest email timestamp
        if (!account.user.lastEmailProcessedAt) {
          log('No previous timestamp found. Getting latest email timestamp...');
          const latestTimestamp = await getLatestEmailTimestamp(gmail);

          if (latestTimestamp) {
            await prisma.user.update({
              where: { id: account.user.id },
              data: { lastEmailProcessedAt: latestTimestamp }
            });
            log(`Set initial timestamp to ${latestTimestamp.toISOString()} for user ${account.user.email || account.user.id}`);
          } else {
            log(`No emails found for user ${account.user.email || account.user.id}`);
          }

          continue; // Skip to next account
        }

        // Fetch emails received after the last processed timestamp
        const emails = await fetchRecentEmails(gmail, account.user.lastEmailProcessedAt);

        if (emails.length > 0) {
          log(`Found ${emails.length} new emails for user: ${account.user.email || account.user.id}`);

          // Track the most recent email timestamp
          let latestEmailTimestamp: Date | null = null;

          for (const email of emails) {
            const parsedEmail = parseEmail(email);

            // Update the latest timestamp if this email is newer
            if (email.internalDate) {
              const emailDate = new Date(parseInt(email.internalDate));
              if (!latestEmailTimestamp || emailDate > latestEmailTimestamp) {
                latestEmailTimestamp = emailDate;
              }
            }

            // Get suggested actions from Gemini
            const suggestedActions = await getSuggestedActions(parsedEmail.subject, parsedEmail.body, account.user.id);

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

            if (suggestedActions.length > 0) {
              // Create inbox entry
              await createInboxEntry(
                account.user.id,
                parsedEmail,
                suggestedActions,
                account.user.emailPermissionLevel === 'modify-compose'
              );
            }
            else {
              log('No suggested actions found for this email.');
            }

            totalProcessedEmails++;
          }

          // Update the user's lastEmailProcessedAt timestamp
          if (latestEmailTimestamp) {
            await prisma.user.update({
              where: { id: account.user.id },
              data: { lastEmailProcessedAt: latestEmailTimestamp }
            });
            log(`Updated last processed timestamp to ${latestEmailTimestamp.toISOString()} for user ${account.user.email || account.user.id}`);
          }
        } else {
          log(`No new emails found for user: ${account.user.email || account.user.id}`);
        }
      } catch (error) {
        log(`Error processing emails for user ${account.user.id}: ${error instanceof Error ? error.message : String(error)}`, 'error');
      }
    }

    if (totalProcessedEmails === 0) {
      log('No new emails to process.');
    } else {
      log(`Processed ${totalProcessedEmails} new emails.`);
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
