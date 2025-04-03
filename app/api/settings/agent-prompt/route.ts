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
    const { prompt } = body;

    if (prompt === undefined) {
      return NextResponse.json({ error: 'Missing prompt parameter' }, { status: 400 });
    }

    // Update user's custom agent prompt
    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        customAgentPrompt: prompt,
      },
    });

    // Create a log entry for this action
    await prisma.log.create({
      data: {
        message: `User updated custom agent prompt`,
        level: 'info',
        source: 'settings',
        userId: session.user.id
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating custom agent prompt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user data
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { customAgentPrompt: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ customAgentPrompt: user.customAgentPrompt || '' });
  } catch (error) {
    console.error('Error getting custom agent prompt:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
}
