import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/options';

// GET a specific inbox entry
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const entry = await prisma.inboxEntry.findUnique({
      where: {
        id,
      },
      include: {
        actions: true,
      },
    });

    if (!entry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    // Check if the entry belongs to the current user
    if (entry.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error fetching inbox entry:', error);
    return NextResponse.json({ error: 'Failed to fetch inbox entry' }, { status: 500 });
  }
}

// PUT update a specific inbox entry
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if the entry exists and belongs to the current user
    const existingEntry = await prisma.inboxEntry.findUnique({
      where: {
        id,
      },
    });

    if (!existingEntry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    if (existingEntry.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { title, content, actions } = await req.json();

    // Update the entry
    const updatedEntry = await prisma.inboxEntry.update({
      where: {
        id,
      },
      data: {
        title,
        content,
      },
      include: {
        actions: true,
      },
    });

    // If actions are provided, update them
    if (actions && Array.isArray(actions)) {
      // Delete existing actions
      await prisma.action.deleteMany({
        where: {
          inboxEntryId: id,
        },
      });

      // Create new actions
      for (const action of actions) {
        await prisma.action.create({
          data: {
            description: action.description,
            completed: action.completed || false,
            dueDate: action.dueDate || null,
            inboxEntryId: id,
          },
        });
      }

      // Fetch the updated entry with actions
      const entryWithActions = await prisma.inboxEntry.findUnique({
        where: {
          id,
        },
        include: {
          actions: true,
        },
      });

      return NextResponse.json(entryWithActions);
    }

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error('Error updating inbox entry:', error);
    return NextResponse.json({ error: 'Failed to update inbox entry' }, { status: 500 });
  }
}

// DELETE a specific inbox entry
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if the entry exists and belongs to the current user
    const existingEntry = await prisma.inboxEntry.findUnique({
      where: {
        id,
      },
    });

    if (!existingEntry) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    if (existingEntry.userId !== session.user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Delete the entry (actions will be cascaded due to the relation setup)
    await prisma.inboxEntry.delete({
      where: {
        id,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting inbox entry:', error);
    return NextResponse.json({ error: 'Failed to delete inbox entry' }, { status: 500 });
  }
}
