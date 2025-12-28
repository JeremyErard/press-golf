// Press Golf App - Shared Types
// Used by both API and Mobile apps

// ===================
// API Response Types
// ===================

export interface ApiResponse<T = unknown> {
  success: true;
  data: T;
}

export interface ApiError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}

export type ApiResult<T> = ApiResponse<T> | ApiError;

// ===================
// User Types
// ===================

export interface User {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  phone: string | null;
  ghinNumber: string | null;
  handicapIndex: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface UserUpdateInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  ghinNumber?: string;
  handicapIndex?: number;
}

// ===================
// Payment Method Types
// ===================

export type PaymentMethodType = 'VENMO' | 'ZELLE' | 'CASHAPP' | 'APPLE_PAY';

export interface PaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
  handle: string;
  isPreferred: boolean;
  createdAt: string;
}

export interface PaymentMethodCreateInput {
  type: PaymentMethodType;
  handle: string;
  isPreferred?: boolean;
}

// ===================
// Validation Helpers
// ===================

export function validatePaymentHandle(type: PaymentMethodType, handle: string): string | null {
  switch (type) {
    case 'VENMO':
      if (!handle.startsWith('@')) {
        return 'Venmo handle must start with @';
      }
      break;
    case 'CASHAPP':
      if (!handle.startsWith('$')) {
        return 'Cash App handle must start with $';
      }
      break;
    case 'ZELLE':
      // Email or phone - basic validation
      if (!handle.includes('@') && !/^\+?[\d\s-()]+$/.test(handle)) {
        return 'Zelle requires a valid email or phone number';
      }
      break;
    case 'APPLE_PAY':
      // Phone number
      if (!/^\+?[\d\s-()]+$/.test(handle)) {
        return 'Apple Pay requires a valid phone number';
      }
      break;
  }
  return null;
}

// ===================
// Error Codes
// ===================

export const ErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = typeof ErrorCodes[keyof typeof ErrorCodes];
