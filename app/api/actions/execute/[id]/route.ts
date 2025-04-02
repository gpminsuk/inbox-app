import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';

// POST /api/actions/execute/[id] - Execute an action
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Action ID is required' }, { status: 400 });
    }

    // Find the action
    const action = await prisma.action.findUnique({
      where: { id },
      include: { inboxEntry: true },
    });

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // Check if the user owns this action
    if (action.inboxEntry.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Mark the action as completed
    const updatedAction = await prisma.action.update({
      where: { id },
      data: {
        completed: true
      },
    });

    // Create a log entry for the executed action
    await prisma.log.create({
      data: {
        message: `Action executed: ${action.description}`,
        level: 'info',
        source: 'user-action',
        userId: session.user.id,
      },
    });

    return NextResponse.json(updatedAction);
  } catch (error) {
    console.error('Error executing action:', error);
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    );
  }
}
