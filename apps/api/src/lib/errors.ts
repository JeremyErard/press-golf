import { FastifyReply } from 'fastify';

export const ErrorCodes = {
  // Auth
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  // Request
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  RATE_LIMITED: 'RATE_LIMITED',
  // Server
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  // Domain-specific
  ROUND_CREATION_FAILED: 'ROUND_CREATION_FAILED',
  COURSE_CREATION_FAILED: 'COURSE_CREATION_FAILED',
  IMAGE_PROCESSING_FAILED: 'IMAGE_PROCESSING_FAILED',
  INVALID_SETTLEMENT: 'INVALID_SETTLEMENT',
  FINALIZATION_FAILED: 'FINALIZATION_FAILED',
  CALCULATION_ERROR: 'CALCULATION_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];

interface ErrorResponse {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
  };
}

export function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: ErrorCode,
  message: string
): FastifyReply {
  const response: ErrorResponse = {
    success: false,
    error: { code, message },
  };
  return reply.status(statusCode).send(response);
}

export function badRequest(reply: FastifyReply, message: string): FastifyReply {
  return sendError(reply, 400, ErrorCodes.VALIDATION_ERROR, message);
}

export function unauthorized(reply: FastifyReply, message = 'Authentication required'): FastifyReply {
  return sendError(reply, 401, ErrorCodes.UNAUTHORIZED, message);
}

export function forbidden(reply: FastifyReply, message = 'Access denied'): FastifyReply {
  return sendError(reply, 403, ErrorCodes.FORBIDDEN, message);
}

export function notFound(reply: FastifyReply, message = 'Resource not found'): FastifyReply {
  return sendError(reply, 404, ErrorCodes.NOT_FOUND, message);
}

export function conflict(reply: FastifyReply, message: string): FastifyReply {
  return sendError(reply, 409, ErrorCodes.CONFLICT, message);
}

export function internalError(reply: FastifyReply, message = 'Internal server error'): FastifyReply {
  return sendError(reply, 500, ErrorCodes.INTERNAL_ERROR, message);
}
