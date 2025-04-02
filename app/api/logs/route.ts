import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';

// GET /api/logs - Fetch logs with pagination
export async function GET(request: Request) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const source = searchParams.get('source') || undefined;
    const level = searchParams.get('level') || undefined;
    const before = searchParams.get('before') || undefined; // Cursor for pagination (timestamp)
    
    // Build where clause
    const where: any = {};
    if (source) where.source = { equals: source };
    if (level) where.level = { equals: level };
    
    // Add cursor condition if provided
    if (before) {
      where.timestamp = { lt: new Date(before) };
    }

    // Get total count for pagination info
    const total = await prisma.log.count({
      where: {
        source: source ? { equals: source } : undefined,
        level: level ? { equals: level } : undefined,
      }
    });

    // Fetch logs with cursor-based pagination in ascending order
    const logs = await prisma.log.findMany({
      where,
      orderBy: {
        timestamp: 'desc', // Fetch newest first
      },
      take: limit,
    });

    // Sort logs in ascending order for display
    const sortedLogs = [...logs].reverse();

    // Get the cursor for the next page
    const nextCursor = logs.length > 0 ? logs[logs.length - 1].timestamp.toISOString() : null;

    // Return logs with pagination info
    return NextResponse.json({
      logs: sortedLogs,
      pagination: {
        total,
        limit,
        nextCursor,
        hasMore: logs.length === limit,
      },
    });
  } catch (error) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}
