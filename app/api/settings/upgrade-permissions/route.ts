import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/options';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Verify user is authenticated
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await req.json();
    const { userId } = body;

    // Verify the user is updating their own settings
    if (session.user.id !== userId) {
      return NextResponse.json(
        { error: 'Forbidden: Cannot modify other users' },
        { status: 403 }
      );
    }

    // Update the user's permission level to modify-compose
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        emailPermissionLevel: 'modify-compose',
      },
    });

    return NextResponse.json({
      success: true,
      emailPermissionLevel: updatedUser.emailPermissionLevel,
    });
  } catch (error) {
    console.error('Error upgrading permissions:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
