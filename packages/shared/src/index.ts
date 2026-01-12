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

// ===================
// Game Types & Rules
// ===================

export type GameType = 'NASSAU' | 'MATCH_PLAY' | 'SKINS' | 'WOLF' | 'VEGAS' | 'NINES' | 'STABLEFORD';

export interface GamePlayerRules {
  min: number;
  max: number;
  exact?: number;
  message: string;
  description: string;
}

export const GAME_PLAYER_RULES: Record<GameType, GamePlayerRules> = {
  NASSAU: {
    min: 2,
    max: 2,
    exact: 2,
    message: 'Nassau requires exactly 2 players (head-to-head match play)',
    description: 'Head-to-head match play with 3 bets: front 9, back 9, and overall 18',
  },
  MATCH_PLAY: {
    min: 2,
    max: 2,
    exact: 2,
    message: 'Match Play requires exactly 2 players',
    description: 'Head-to-head competition where the player who wins the most holes wins',
  },
  VEGAS: {
    min: 4,
    max: 4,
    exact: 4,
    message: 'Vegas requires exactly 4 players (2 teams of 2)',
    description: 'Team game where scores are combined to form a 2-digit number',
  },
  WOLF: {
    min: 4,
    max: 4,
    exact: 4,
    message: 'Wolf requires exactly 4 players',
    description: 'Rotating "wolf" picks partner or goes alone against the pack',
  },
  NINES: {
    min: 3,
    max: 4,
    message: 'Nines requires 3-4 players',
    description: '9 points per hole split among players based on scores',
  },
  SKINS: {
    min: 2,
    max: 16,
    message: 'Skins requires 2-16 players',
    description: 'Win the hole outright to claim the skin; ties carry over',
  },
  STABLEFORD: {
    min: 1,
    max: 16,
    message: 'Stableford requires 1-16 players',
    description: 'Points awarded based on score relative to par',
  },
};

export function validateGamePlayerCount(gameType: GameType, playerCount: number): string | null {
  const rules = GAME_PLAYER_RULES[gameType];
  if (!rules) return null;

  if (rules.exact && playerCount !== rules.exact) {
    return rules.message;
  }
  if (playerCount < rules.min || playerCount > rules.max) {
    return rules.message;
  }
  return null;
}
