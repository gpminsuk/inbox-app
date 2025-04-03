import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await req.json();
    const { prompt, actionId } = body;

    if (!prompt || !actionId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Get action details
    const action = await prisma.action.findUnique({
      where: { id: actionId },
      include: { inboxEntry: true }
    });

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // Fetch the user's information including name, email, and custom agent prompt
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { 
        name: true,
        email: true,
        customAgentPrompt: true 
      }
    });

    // Create a log entry for this agent action
    await prisma.log.create({
      data: {
        message: `Requesting agent to run for action: ${action.description}${user?.customAgentPrompt ? ' (with custom prompt)' : ''}`,
        level: 'info',
        source: 'next-api',
        userId: session.user.id
      }
    });

    // Update the action status to "running" in the database before calling the agent server
    // This ensures the UI immediately shows the action as running
    await prisma.action.update({
      where: { id: actionId },
      data: {
        metadata: {
          ...(action.metadata as any || {}),
          agentStatus: 'running'
        }
      }
    });

    try {
      const agentResponse = await fetch(`${process.env.AGENT_SERVER_URL}/run-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt, // Send the original prompt
          customPrompt: user?.customAgentPrompt, // Send the custom prompt separately
          userInfo: {
            name: user?.name,
            email: user?.email
          },
          timeout: 120, // 2 minutes timeout
          actionId // Pass the actionId to the agent server
        }),
      });

      if (!agentResponse.ok) {
        const errorData = await agentResponse.json();
        throw new Error(`Agent server error: ${errorData.error || agentResponse.statusText}`);
      }

      const agentResult = await agentResponse.json();

      // Update the action in the database with the recording file
      if (agentResult.recordingFile) {
        await prisma.action.update({
          where: { id: actionId },
          data: {
            metadata: {
              ...(action.metadata as any || {}),
              agentStatus: 'running', // Ensure the status is still running
              recordingFile: agentResult.recordingFile
            }
          }
        });
      }

      // Return the result immediately - the agent server will handle updating the action
      return NextResponse.json({
        success: true,
        taskId: agentResult.task_id,
        status: agentResult.status,
        actionId,
        recordingFile: agentResult.recordingFile
      });
    } catch (error) {
      console.error('Error running agent:', error);

      // If there's an error, update the action status to "error"
      await prisma.action.update({
        where: { id: actionId },
        data: {
          metadata: {
            ...(action.metadata as any || {}),
            agentStatus: 'error',
            agentError: error instanceof Error ? error.message : 'An unknown error occurred'
          }
        }
      });

      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'An unknown error occurred' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error running agent:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}

// GET endpoint to check the status of an agent task
export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the actionId from the URL
    const url = new URL(req.url);
    const actionId = url.searchParams.get('actionId');

    if (!actionId) {
      return NextResponse.json({ error: 'Missing actionId parameter' }, { status: 400 });
    }

    // Get action details
    const action = await prisma.action.findUnique({
      where: { id: actionId }
    });

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // Simply return the current action status from the database
    // The agent server is updating the action directly in the database
    return NextResponse.json(action);
  } catch (error) {
    console.error('Error checking agent status:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}
