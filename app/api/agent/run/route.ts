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

    // Create a log entry for this agent action
    await prisma.log.create({
      data: {
        message: `Requesting agent to run for action: ${action.description}`,
        level: 'info',
        source: 'next-api',
        userId: session.user.id
      }
    });

    try {
      const agentResponse = await fetch(`${process.env.AGENT_SERVER_URL}/run-agent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          timeout: 120, // 2 minutes timeout
          actionId // Pass the actionId to the agent server
        }),
      });

      if (!agentResponse.ok) {
        const errorData = await agentResponse.json();
        throw new Error(`Agent server error: ${errorData.error || agentResponse.statusText}`);
      }

      const agentResult = await agentResponse.json();

      // Return the result immediately - the agent server will handle updating the action
      return NextResponse.json({
        success: true,
        taskId: agentResult.task_id,
        status: agentResult.status,
        actionId
      });
    } catch (error) {
      console.error('Error running agent:', error);
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
