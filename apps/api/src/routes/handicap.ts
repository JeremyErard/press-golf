import { FastifyPluginAsync } from 'fastify';
import multipart from '@fastify/multipart';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../lib/prisma.js';
import { requireAuth, getUser } from '../lib/auth.js';
import { badRequest, notFound, forbidden, sendError, ErrorCodes } from '../lib/errors.js';
import { uploadHandicapProof, validateImage, deleteImage } from '../lib/blob.js';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface VerifyHandicapBody {
  handicapIndex: number;
  source: 'GHIN' | 'USGA' | 'CLUB' | 'OTHER';
  proofUrl?: string;
}

interface ManualHandicapBody {
  handicapIndex: number;
}

interface ApproveHandicapBody {
  status: 'APPROVED' | 'REJECTED';
}

const handicapRoutes: FastifyPluginAsync = async (app) => {
  // Register multipart for file uploads
  await app.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max
    },
  });

  // All handicap routes require authentication
  app.addHook('preHandler', requireAuth);

  // =====================
  // POST /api/handicap/extract
  // Extract handicap from uploaded screenshot using Claude Vision
  // =====================
  app.post('/extract', async (request, reply) => {
    const user = getUser(request);

    const data = await request.file();
    if (!data) {
      return badRequest(reply, 'No image file provided');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(data.mimetype)) {
      return badRequest(reply, 'Invalid file type. Please upload a JPEG, PNG, WebP, or GIF image.');
    }

    // Read file into buffer
    const buffer = await data.toBuffer();
    const base64Image = buffer.toString('base64');

    // Determine media type for Claude
    const mediaType = data.mimetype as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

    try {
      // Use Claude Vision to extract handicap
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image,
                },
              },
              {
                type: 'text',
                text: `Extract the handicap index number from this golf handicap screenshot.

Look for:
- "Handicap Index" followed by a number (e.g., 12.5, 8.3, 15.0)
- GHIN numbers or USGA handicap displays
- Club handicap cards or certificates

Return ONLY a JSON object with this format:
{
  "found": true,
  "handicapIndex": 12.5,
  "source": "GHIN",
  "confidence": "high"
}

If you cannot find a handicap index, return:
{
  "found": false,
  "reason": "explanation"
}

The source should be one of: GHIN, USGA, CLUB, OTHER
Confidence should be: high, medium, or low`,
              },
            ],
          },
        ],
      });

      // Extract text from response
      const responseText = message.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('');

      // Parse JSON from response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return reply.send({
          success: false,
          error: 'Could not parse handicap from image',
        });
      }

      const extracted = JSON.parse(jsonMatch[0]);

      if (!extracted.found) {
        return reply.send({
          success: false,
          error: extracted.reason || 'Could not find handicap index in image',
        });
      }

      // Validate handicap range (USGA: +9.9 to 54.0)
      const handicap = parseFloat(extracted.handicapIndex);
      if (isNaN(handicap) || handicap < -9.9 || handicap > 54.0) {
        return reply.send({
          success: false,
          error: 'Invalid handicap index. Must be between +9.9 and 54.0',
        });
      }

      // Upload proof image to blob storage
      let proofUrl: string | null = null;
      try {
        const filename = data.filename || 'handicap-proof.jpg';
        const result = await uploadHandicapProof(buffer, filename, user.id as string);
        proofUrl = result.url;
      } catch (uploadError) {
        request.log.warn(uploadError, 'Failed to upload handicap proof image');
        // Continue without proof URL - extraction still succeeded
      }

      return reply.send({
        success: true,
        data: {
          handicapIndex: handicap,
          source: extracted.source || 'OTHER',
          confidence: extracted.confidence || 'medium',
          proofUrl,
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to extract handicap from image');
      return sendError(reply, 500, ErrorCodes.IMAGE_PROCESSING_FAILED, 'Failed to process image');
    }
  });

  // =====================
  // POST /api/handicap/verify
  // Save verified handicap from OCR extraction
  // =====================
  app.post<{ Body: VerifyHandicapBody }>('/verify', async (request, reply) => {
    const user = getUser(request);
    const { handicapIndex, source, proofUrl } = request.body;

    // Validate handicap (USGA: +9.9 to 54.0)
    if (typeof handicapIndex !== 'number' || handicapIndex < -9.9 || handicapIndex > 54.0) {
      return badRequest(reply, 'Invalid handicap index. Must be between +9.9 and 54.0');
    }

    const validSources = ['GHIN', 'USGA', 'CLUB', 'OTHER'];
    if (!validSources.includes(source)) {
      return badRequest(reply, 'Invalid source. Must be GHIN, USGA, CLUB, or OTHER.');
    }

    // Get current user to check for old proof URL
    const currentUser = await prisma.user.findUnique({
      where: { id: user.id as string },
      select: { handicapProofUrl: true },
    });

    // Update user with verified handicap and proof, and create history entry
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id as string },
        data: {
          handicapIndex,
          handicapSource: source as 'GHIN' | 'USGA' | 'CLUB' | 'OTHER',
          handicapVerifiedAt: new Date(),
          handicapPendingApproval: false,
          handicapProofUrl: proofUrl || null,
        },
      }),
      prisma.handicapHistory.create({
        data: {
          userId: user.id as string,
          handicapIndex,
          source: source as 'GHIN' | 'USGA' | 'CLUB' | 'OTHER',
        },
      }),
    ]);

    // Delete old proof image if exists and different from new one
    if (currentUser?.handicapProofUrl && currentUser.handicapProofUrl !== proofUrl) {
      deleteImage(currentUser.handicapProofUrl).catch((err) => {
        request.log.warn(err, 'Failed to delete old handicap proof');
      });
    }

    return reply.send({
      success: true,
      data: {
        handicapIndex: updatedUser.handicapIndex,
        handicapSource: updatedUser.handicapSource,
        handicapVerifiedAt: updatedUser.handicapVerifiedAt,
        handicapProofUrl: updatedUser.handicapProofUrl,
        isVerified: true,
      },
    });
  });

  // =====================
  // POST /api/handicap/manual
  // Submit manual handicap (requires round creator approval)
  // =====================
  app.post<{ Body: ManualHandicapBody }>('/manual', async (request, reply) => {
    const user = getUser(request);
    const { handicapIndex } = request.body;

    // Validate handicap (USGA: +9.9 to 54.0)
    if (typeof handicapIndex !== 'number' || handicapIndex < -9.9 || handicapIndex > 54.0) {
      return badRequest(reply, 'Invalid handicap index. Must be between +9.9 and 54.0');
    }

    // Update user with manual handicap (pending approval) and create history entry
    const [updatedUser] = await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id as string },
        data: {
          handicapIndex,
          handicapSource: 'MANUAL',
          handicapVerifiedAt: new Date(),
          handicapPendingApproval: true,
        },
      }),
      prisma.handicapHistory.create({
        data: {
          userId: user.id as string,
          handicapIndex,
          source: 'MANUAL',
        },
      }),
    ]);

    return reply.send({
      success: true,
      data: {
        handicapIndex: updatedUser.handicapIndex,
        handicapSource: 'MANUAL',
        handicapVerifiedAt: updatedUser.handicapVerifiedAt,
        pendingApproval: true,
        message: 'Manual handicap submitted. Approval required from round creator before games.',
      },
    });
  });

  // =====================
  // GET /api/handicap/status
  // Get current handicap status
  // =====================
  app.get('/status', async (request, reply) => {
    const user = getUser(request);

    const fullUser = await prisma.user.findUnique({
      where: { id: user.id as string },
      select: {
        handicapIndex: true,
        handicapSource: true,
        handicapVerifiedAt: true,
        handicapPendingApproval: true,
      },
    });

    if (!fullUser) {
      return notFound(reply, 'User not found');
    }

    // Check if handicap is expired (30+ days old)
    const isExpired = fullUser.handicapVerifiedAt
      ? (Date.now() - new Date(fullUser.handicapVerifiedAt).getTime()) > 30 * 24 * 60 * 60 * 1000
      : false;

    // Determine status
    let status: 'none' | 'verified' | 'manual_pending' | 'expired';
    if (!fullUser.handicapIndex) {
      status = 'none';
    } else if (fullUser.handicapPendingApproval) {
      status = 'manual_pending';
    } else if (isExpired) {
      status = 'expired';
    } else {
      status = 'verified';
    }

    return reply.send({
      success: true,
      data: {
        handicapIndex: fullUser.handicapIndex ? Number(fullUser.handicapIndex) : null,
        source: fullUser.handicapSource,
        verifiedAt: fullUser.handicapVerifiedAt,
        status,
        isExpired,
        daysUntilExpiry: fullUser.handicapVerifiedAt
          ? Math.max(0, 30 - Math.floor((Date.now() - new Date(fullUser.handicapVerifiedAt).getTime()) / (24 * 60 * 60 * 1000)))
          : null,
      },
    });
  });

  // =====================
  // GET /api/handicap/history
  // Get handicap history for current user
  // =====================
  app.get('/history', async (request, reply) => {
    const user = getUser(request);

    const history = await prisma.handicapHistory.findMany({
      where: { userId: user.id as string },
      orderBy: { createdAt: 'desc' },
      take: 50, // Limit to last 50 entries
    });

    return reply.send({
      success: true,
      data: history.map((entry) => ({
        id: entry.id,
        handicapIndex: Number(entry.handicapIndex),
        source: entry.source,
        createdAt: entry.createdAt,
      })),
    });
  });

  // =====================
  // GET /api/handicap/pending
  // Get pending handicap approvals for rounds you created
  // =====================
  app.get('/pending', async (request, reply) => {
    const user = getUser(request);

    // Find all pending approvals for rounds this user created
    const pendingApprovals = await prisma.handicapApproval.findMany({
      where: {
        status: 'PENDING',
        round: {
          createdById: user.id as string,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            displayName: true,
            avatarUrl: true,
          },
        },
        round: {
          select: {
            id: true,
            date: true,
            course: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return reply.send({
      success: true,
      data: pendingApprovals.map((approval) => ({
        id: approval.id,
        handicap: Number(approval.handicap),
        createdAt: approval.createdAt,
        user: {
          id: approval.user.id,
          name: approval.user.displayName || `${approval.user.firstName || ''} ${approval.user.lastName || ''}`.trim() || 'Unknown',
          avatarUrl: approval.user.avatarUrl,
        },
        round: {
          id: approval.round.id,
          date: approval.round.date,
          courseName: approval.round.course.name,
        },
      })),
    });
  });

  // =====================
  // POST /api/handicap/approve/:approvalId
  // Approve or reject a manual handicap (round creator only)
  // =====================
  app.post<{ Params: { approvalId: string }; Body: ApproveHandicapBody }>(
    '/approve/:approvalId',
    async (request, reply) => {
      const user = getUser(request);
      const { approvalId } = request.params;
      const { status } = request.body;

      if (!['APPROVED', 'REJECTED'].includes(status)) {
        return badRequest(reply, 'Invalid status. Must be APPROVED or REJECTED.');
      }

      // Find the approval
      const approval = await prisma.handicapApproval.findUnique({
        where: { id: approvalId },
        include: {
          round: {
            select: {
              createdById: true,
            },
          },
        },
      });

      if (!approval) {
        return notFound(reply, 'Approval request not found');
      }

      // Check if current user is the round creator
      if (approval.round.createdById !== user.id) {
        return forbidden(reply, 'Only the round creator can approve handicaps');
      }

      // Update approval status
      const updatedApproval = await prisma.handicapApproval.update({
        where: { id: approvalId },
        data: {
          status: status as 'APPROVED' | 'REJECTED',
          approvedBy: user.clerkId as string,
        },
      });

      return reply.send({
        success: true,
        data: {
          id: updatedApproval.id,
          status: updatedApproval.status,
          message: status === 'APPROVED'
            ? 'Handicap approved for this round'
            : 'Handicap rejected. Player must update their handicap.',
        },
      });
    }
  );

  // =====================
  // POST /api/handicap/request-approval/:roundId
  // Request approval for manual handicap in a specific round
  // =====================
  app.post<{ Params: { roundId: string } }>(
    '/request-approval/:roundId',
    async (request, reply) => {
      const user = getUser(request);
      const { roundId } = request.params;

      // Get user's current handicap
      const fullUser = await prisma.user.findUnique({
        where: { id: user.id as string },
        select: {
          handicapIndex: true,
          handicapSource: true,
          handicapPendingApproval: true,
        },
      });

      if (!fullUser || !fullUser.handicapIndex) {
        return badRequest(reply, 'No handicap set. Please set your handicap first.');
      }

      // Only manual handicaps need approval
      if (fullUser.handicapSource !== 'MANUAL') {
        return reply.send({
          success: true,
          data: {
            needsApproval: false,
            message: 'Verified handicap does not require approval',
          },
        });
      }

      // Check if round exists
      const round = await prisma.round.findUnique({
        where: { id: roundId },
        select: { id: true, createdById: true },
      });

      if (!round) {
        return notFound(reply, 'Round not found');
      }

      // Check if approval already exists
      const existingApproval = await prisma.handicapApproval.findUnique({
        where: {
          userId_roundId: {
            userId: user.id as string,
            roundId,
          },
        },
      });

      if (existingApproval) {
        return reply.send({
          success: true,
          data: {
            id: existingApproval.id,
            status: existingApproval.status,
            needsApproval: existingApproval.status === 'PENDING',
            message: existingApproval.status === 'PENDING'
              ? 'Approval already requested'
              : `Handicap ${existingApproval.status.toLowerCase()}`,
          },
        });
      }

      // Create new approval request
      const approval = await prisma.handicapApproval.create({
        data: {
          userId: user.id as string,
          roundId,
          handicap: fullUser.handicapIndex,
          status: 'PENDING',
        },
      });

      return reply.send({
        success: true,
        data: {
          id: approval.id,
          status: 'PENDING',
          needsApproval: true,
          message: 'Approval requested from round creator',
        },
      });
    }
  );
};

export default handicapRoutes;
