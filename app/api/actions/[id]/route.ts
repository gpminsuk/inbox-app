import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';

// PUT update a specific action
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { description, completed, dueDate } = await req.json();

    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the action
    const action = await prisma.action.findUnique({
      where: {
        id,
      },
      include: {
        inboxEntry: true,
      },
    });

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // Check if the action belongs to the current user
    if (action.inboxEntry.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Update the action
    const updatedAction = await prisma.action.update({
      where: {
        id,
      },
      data: {
        description,
        completed,
        dueDate,
      },
    });

    return NextResponse.json(updatedAction);
  } catch (error) {
    console.error('Error updating action:', error);
    return NextResponse.json({ error: 'Failed to update action' }, { status: 500 });
  }
}

// DELETE a specific action
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Find the action
    const action = await prisma.action.findUnique({
      where: {
        id,
      },
      include: {
        inboxEntry: true,
      },
    });

    if (!action) {
      return NextResponse.json({ error: 'Action not found' }, { status: 404 });
    }

    // Check if the action belongs to the current user
    if (action.inboxEntry.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete the action
    await prisma.action.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting action:', error);
    return NextResponse.json({ error: 'Failed to delete action' }, { status: 500 });
  }
}
