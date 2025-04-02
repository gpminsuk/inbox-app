import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/options';

// GET all inbox entries for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);

    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const entries = await prisma.inboxEntry.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        actions: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Error fetching inbox entries:', error);
    return NextResponse.json({ error: 'Failed to fetch inbox entries' }, { status: 500 });
  }
}
