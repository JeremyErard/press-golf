import { useAuth } from '@clerk/clerk-expo';
import { useEffect } from 'react';

// Base URL for API - use localhost for development
const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

// Singleton API client
class ApiClient {
  private getToken: (() => Promise<string | null>) | null = null;

  setTokenGetter(getter: () => Promise<string | null>) {
    this.getToken = getter;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<{ success: true; data: T } | { success: false; error: { code: string; message: string } }> {
    try {
      const token = this.getToken ? await this.getToken() : null;

      const response = await fetch(`${BASE_URL}${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || { code: 'UNKNOWN', message: 'Request failed' },
        };
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      return {
        success: false,
        error: {
          code: 'NETWORK_ERROR',
          message: 'Unable to connect to server',
        },
      };
    }
  }

  // GET request
  get<T>(path: string) {
    return this.request<T>(path, { method: 'GET' });
  }

  // POST request
  post<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  // PATCH request
  patch<T>(path: string, body: unknown) {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  // DELETE request
  delete<T>(path: string) {
    return this.request<T>(path, { method: 'DELETE' });
  }
}

// Export singleton instance
export const api = new ApiClient();

// Hook to initialize API with Clerk token
export function useApi() {
  const { getToken } = useAuth();

  useEffect(() => {
    api.setTokenGetter(getToken);
  }, [getToken]);

  return api;
}

// ===================
// Type definitions
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
  paymentMethods: PaymentMethod[];
}

export interface PaymentMethod {
  id: string;
  userId: string;
  type: 'VENMO' | 'ZELLE' | 'CASHAPP' | 'APPLE_PAY';
  handle: string;
  isPreferred: boolean;
  createdAt: string;
}

export interface UserUpdateInput {
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phone?: string;
  ghinNumber?: string;
  handicapIndex?: number;
}

export interface PaymentMethodInput {
  type: 'VENMO' | 'ZELLE' | 'CASHAPP' | 'APPLE_PAY';
  handle: string;
  isPreferred?: boolean;
}

// ===================
// Course types
// ===================

export interface Course {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string;
  logoUrl: string | null;
  website: string | null;
  isVerified: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
  tees?: Tee[];
  holes?: Hole[];
  _count?: { holes: number };
}

export interface Tee {
  id: string;
  courseId: string;
  name: string;
  color: string | null;
  slopeRating: number | null;
  courseRating: number | null;
  totalYardage: number | null;
}

export interface Hole {
  id: string;
  courseId: string;
  holeNumber: number;
  par: number;
  handicapRank: number;
  yardages?: HoleYardage[];
}

export interface HoleYardage {
  id: string;
  holeId: string;
  teeId: string;
  yardage: number;
  tee?: Tee;
}

export interface CreateCourseInput {
  name: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  tees?: {
    name: string;
    color?: string;
    slopeRating?: number;
    courseRating?: number;
    totalYardage?: number;
  }[];
  holes?: {
    holeNumber: number;
    par: number;
    handicapRank: number;
    yardages?: { teeName: string; yardage: number }[];
  }[];
}

export interface ExtractedCourseData {
  name: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  tees?: {
    name: string;
    color?: string;
    slopeRating?: number;
    courseRating?: number;
    totalYardage?: number;
  }[];
  holes?: {
    holeNumber: number;
    par: number;
    handicapRank: number;
    yardages?: { teeName: string; yardage: number }[];
  }[];
}

// ===================
// Round types (Phase 3)
// ===================

export type RoundStatus = 'SETUP' | 'ACTIVE' | 'COMPLETED';

export interface Round {
  id: string;
  courseId: string;
  teeId: string;
  date: string;
  status: RoundStatus;
  inviteCode: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  course?: Course;
  tee?: Tee;
  players?: RoundPlayer[];
  _count?: { players: number };
}

export interface RoundPlayer {
  id: string;
  roundId: string;
  userId: string;
  courseHandicap: number | null;
  position: number;
  user?: {
    id: string;
    displayName: string | null;
    firstName: string | null;
    avatarUrl: string | null;
    handicapIndex?: number | null;
  };
  scores?: HoleScore[];
}

export interface HoleScore {
  id: string;
  roundPlayerId: string;
  holeNumber: number;
  strokes: number | null;
  putts: number | null;
}

export interface CreateRoundInput {
  courseId: string;
  teeId: string;
  date?: string;
}
