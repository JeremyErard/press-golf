const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_URL}${endpoint}`;

  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new ApiError("NETWORK_ERROR", "Network error. Please check your connection.", 0);
  }

  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    throw new ApiError("PARSE_ERROR", "Invalid response from server.", response.status);
  }

  if (!response.ok || !json.success) {
    const error = json.error || { code: "UNKNOWN", message: "An error occurred" };
    throw new ApiError(error.code, error.message, response.status);
  }

  return json.data as T;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// Auth-aware fetch that includes Clerk token
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  token?: string | null
): Promise<T> {
  const headers: HeadersInit = {
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  }

  return request<T>(endpoint, { ...options, headers });
}

// API Client with typed methods
export const api = {
  // User
  getMe: (token: string) => apiRequest<User>("/users/me", {}, token),
  updateMe: (token: string, data: Partial<User>) =>
    apiRequest<User>("/users/me", {
      method: "PATCH",
      body: JSON.stringify(data),
    }, token),
  completeOnboarding: (token: string) =>
    apiRequest<{ onboardingComplete: boolean }>("/users/me/complete-onboarding", {
      method: "POST",
      body: JSON.stringify({}),
    }, token),
  searchUsers: (token: string, query: string) =>
    apiRequest<Array<{
      id: string;
      displayName?: string;
      firstName?: string;
      lastName?: string;
      avatarUrl?: string;
      handicapIndex?: number;
    }>>(`/users/search?q=${encodeURIComponent(query)}`, {}, token),

  // Rounds
  getRounds: (token: string) => apiRequest<Round[]>("/rounds", {}, token),
  getRound: (token: string, id: string) =>
    apiRequest<RoundDetail>(`/rounds/${id}`, {}, token),
  createRound: (token: string, data: CreateRoundInput) =>
    apiRequest<Round>("/rounds", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),
  joinRound: (token: string, inviteCode: string) =>
    apiRequest<Round>("/rounds/join", {
      method: "POST",
      body: JSON.stringify({ inviteCode }),
    }, token),
  updateRoundStatus: (token: string, id: string, status: "ACTIVE" | "COMPLETED") =>
    apiRequest<RoundDetail>(`/rounds/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }, token),
  deleteRound: (token: string, id: string) =>
    apiRequest<{ deleted: boolean }>(`/rounds/${id}`, {
      method: "DELETE",
    }, token),

  // Courses
  getCourses: (token: string) => apiRequest<Course[]>("/courses", {}, token),
  discoverCourses: (token: string, lat?: number, lng?: number) => {
    const params = new URLSearchParams();
    if (lat !== undefined) params.set("lat", lat.toString());
    if (lng !== undefined) params.set("lng", lng.toString());
    const queryString = params.toString();
    return apiRequest<DiscoverCoursesResponse>(
      `/courses/discover${queryString ? `?${queryString}` : ""}`,
      {},
      token
    );
  },
  getCourse: (token: string, id: string) =>
    apiRequest<CourseDetail>(`/courses/${id}`, {}, token),
  createCourse: (token: string, data: CreateCourseInput) =>
    apiRequest<Course>("/courses", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),
  fetchCourseFromUrl: (token: string, url: string) =>
    apiRequest<ScrapedCourseData>("/courses/fetch-from-url", {
      method: "POST",
      body: JSON.stringify({ url }),
    }, token),

  extractCourseFromImage: async (token: string, frontImage: File, backImage?: File): Promise<ScrapedCourseData & { confidence?: string }> => {
    const formData = new FormData();
    formData.append("frontImage", frontImage);
    if (backImage) {
      formData.append("backImage", backImage);
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
    const response = await fetch(`${API_URL}/courses/extract-from-image`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      credentials: "include",
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new ApiError(
        json.error?.code || "EXTRACTION_FAILED",
        json.error || "Failed to extract scorecard from image",
        response.status
      );
    }
    return json.data;
  },

  // Home Courses
  getHomeCourses: (token: string) =>
    apiRequest<Course[]>("/users/me/home-courses", {}, token),
  addHomeCourse: (token: string, courseId: string) =>
    apiRequest<{ courseId: string; isHomeCourse: boolean }>(`/users/me/home-courses/${courseId}`, {
      method: "POST",
      body: JSON.stringify({}),
    }, token),
  removeHomeCourse: (token: string, courseId: string) =>
    apiRequest<{ courseId: string; isHomeCourse: boolean }>(`/users/me/home-courses/${courseId}`, {
      method: "DELETE",
    }, token),

  // Games
  addGame: (token: string, roundId: string, data: AddGameInput) =>
    apiRequest<Game>("/games", {
      method: "POST",
      body: JSON.stringify({ roundId, ...data }),
    }, token),
  updateGame: (token: string, gameId: string, betAmount: number) =>
    apiRequest<Game>(`/games/${gameId}`, {
      method: "PATCH",
      body: JSON.stringify({ betAmount }),
    }, token),
  deleteGame: (token: string, gameId: string) =>
    apiRequest<{ deleted: boolean }>(`/games/${gameId}`, {
      method: "DELETE",
    }, token),
  calculateResults: (token: string, roundId: string) =>
    apiRequest<CalculateResultsResponse>(`/games/${roundId}/calculate`, {}, token),

  // Settlements
  getSettlements: (token: string, roundId: string) =>
    apiRequest<ApiSettlement[]>(`/games/settlements/${roundId}`, {}, token),
  markSettlementPaid: (token: string, settlementId: string) =>
    apiRequest<ApiSettlement>(`/games/settlements/${settlementId}/paid`, {
      method: "PATCH",
    }, token),
  finalizeRound: (token: string, roundId: string) =>
    apiRequest<{ settlements: ApiSettlement[] }>(`/games/${roundId}/finalize`, {
      method: "POST",
      body: JSON.stringify({}),
    }, token),

  // Scores
  updateScore: (token: string, roundId: string, data: UpdateScoreInput) =>
    apiRequest<HoleScore>(`/rounds/${roundId}/scores`, {
      method: "POST",
      body: JSON.stringify(data),
    }, token),

  // Billing
  createCheckoutSession: (token: string, billingPeriod: "monthly" | "annual" = "monthly") =>
    apiRequest<{ url: string }>("/billing/checkout", {
      method: "POST",
      body: JSON.stringify({ billingPeriod }),
    }, token),
  createPortalSession: (token: string) =>
    apiRequest<{ url: string }>("/billing/portal", {
      method: "POST",
      body: JSON.stringify({}),
    }, token),
  getBillingStatus: (token: string) =>
    apiRequest<BillingStatus>("/billing/status", {}, token),

  // Invites
  createInvite: (token: string, data: CreateInviteInput) =>
    apiRequest<Invite>("/invites", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),
  getInvite: (code: string) =>
    apiRequest<InviteDetails>(`/invites/${code}`, {}), // No auth - public
  acceptInvite: (token: string, code: string) =>
    apiRequest<Round>(`/invites/${code}/accept`, {
      method: "POST",
      body: JSON.stringify({}),
    }, token),

  // Press
  createPress: (token: string, gameId: string, data: CreatePressInput) =>
    apiRequest<Press>(`/games/${gameId}/press`, {
      method: "POST",
      body: JSON.stringify(data),
    }, token),
  getPresses: (token: string, gameId: string) =>
    apiRequest<Press[]>(`/games/${gameId}/presses`, {}, token),
  cancelPress: (token: string, pressId: string) =>
    apiRequest<Press>(`/games/press/${pressId}`, {
      method: "DELETE",
    }, token),
  getPressStatus: (token: string, roundId: string) =>
    apiRequest<PressStatus[]>(`/games/${roundId}/press-status`, {}, token),
  getGameLiveStatus: (token: string, roundId: string) =>
    apiRequest<GameLiveStatus[]>(`/games/${roundId}/live-status`, {}, token),

  // Buddies
  getBuddies: (token: string) =>
    apiRequest<Buddy[]>("/buddies", {}, token),
  addBuddy: (token: string, buddyUserId: string, nickname?: string) =>
    apiRequest<Buddy>("/buddies", {
      method: "POST",
      body: JSON.stringify({ buddyUserId, nickname }),
    }, token),
  removeBuddy: (token: string, buddyId: string) =>
    apiRequest<{ deleted: boolean }>(`/buddies/${buddyId}`, {
      method: "DELETE",
    }, token),
  updateBuddyNickname: (token: string, buddyId: string, nickname?: string) =>
    apiRequest<Buddy>(`/buddies/${buddyId}`, {
      method: "PATCH",
      body: JSON.stringify({ nickname }),
    }, token),
  addBuddyToRound: (token: string, roundId: string, buddyUserId: string) =>
    apiRequest<RoundPlayer>(`/rounds/${roundId}/add-buddy/${buddyUserId}`, {
      method: "POST",
      body: JSON.stringify({}),
    }, token),
  addBuddiesFromRound: (token: string, roundId: string) =>
    apiRequest<{ added: number; message: string }>(`/buddies/from-round/${roundId}`, {
      method: "POST",
      body: JSON.stringify({}),
    }, token),

  // Handicap
  getHandicapStatus: (token: string) =>
    apiRequest<HandicapStatusResponse>("/handicap/status", {}, token),

  extractHandicap: async (token: string, file: File): Promise<ExtractedHandicap> => {
    const formData = new FormData();
    formData.append("file", file);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
    const response = await fetch(`${API_URL}/handicap/extract`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      credentials: "include",
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new ApiError(
        json.error?.code || "EXTRACTION_FAILED",
        json.error || "Failed to extract handicap from image",
        response.status
      );
    }
    return json.data;
  },

  verifyHandicap: (token: string, handicapIndex: number, source: HandicapSource, proofUrl?: string | null) =>
    apiRequest<{ handicapIndex: number; handicapSource: HandicapSource; handicapVerifiedAt: string; handicapProofUrl?: string; isVerified: boolean }>(
      "/handicap/verify",
      {
        method: "POST",
        body: JSON.stringify({ handicapIndex, source, proofUrl }),
      },
      token
    ),

  submitManualHandicap: (token: string, handicapIndex: number) =>
    apiRequest<{ handicapIndex: number; handicapSource: string; handicapVerifiedAt: string; pendingApproval: boolean; message: string }>(
      "/handicap/manual",
      {
        method: "POST",
        body: JSON.stringify({ handicapIndex }),
      },
      token
    ),

  getPendingApprovals: (token: string) =>
    apiRequest<HandicapApproval[]>("/handicap/pending", {}, token),

  approveHandicap: (token: string, approvalId: string, status: "APPROVED" | "REJECTED") =>
    apiRequest<{ id: string; status: ApprovalStatus; message: string }>(
      `/handicap/approve/${approvalId}`,
      {
        method: "POST",
        body: JSON.stringify({ status }),
      },
      token
    ),

  requestHandicapApproval: (token: string, roundId: string) =>
    apiRequest<ApprovalRequest>(`/handicap/request-approval/${roundId}`, {
      method: "POST",
      body: JSON.stringify({}),
    }, token),

  // Payment Methods
  getPaymentMethods: (token: string) =>
    apiRequest<PaymentMethod[]>("/users/me/payment-methods", {}, token),

  addPaymentMethod: (token: string, data: { type: PaymentMethodType; handle: string; isPreferred?: boolean }) =>
    apiRequest<PaymentMethod>("/users/me/payment-methods", {
      method: "POST",
      body: JSON.stringify(data),
    }, token),

  deletePaymentMethod: (token: string, id: string) =>
    apiRequest<{ deleted: boolean }>(`/users/me/payment-methods/${id}`, {
      method: "DELETE",
    }, token),

  setPreferredPaymentMethod: (token: string, id: string) =>
    apiRequest<PaymentMethod>(`/users/me/payment-methods/${id}/preferred`, {
      method: "PATCH",
    }, token),

  // Avatar
  uploadAvatar: async (token: string, file: File): Promise<{ avatarUrl: string }> => {
    const formData = new FormData();
    formData.append("file", file);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
    const response = await fetch(`${API_URL}/users/me/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      credentials: "include",
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new ApiError(
        json.error?.code || "UPLOAD_FAILED",
        json.error?.message || "Failed to upload avatar",
        response.status
      );
    }
    return json.data;
  },

  deleteAvatar: (token: string) =>
    apiRequest<{ deleted: boolean }>("/users/me/avatar", {
      method: "DELETE",
    }, token),

  // Scorecard Photo
  uploadScorecardPhoto: async (token: string, roundId: string, file: File): Promise<ScorecardExtraction> => {
    const formData = new FormData();
    formData.append("file", file);

    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
    const response = await fetch(`${API_URL}/rounds/${roundId}/scorecard-photo`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      credentials: "include",
    });

    const json = await response.json();
    if (!response.ok || !json.success) {
      throw new ApiError(
        json.error?.code || "EXTRACTION_FAILED",
        json.error?.message || json.error || "Failed to extract scores from scorecard",
        response.status
      );
    }
    return json.data;
  },

  confirmScorecardScores: (token: string, roundId: string, scores: { holeNumber: number; strokes: number }[]) =>
    apiRequest<{ savedCount: number; scores: HoleScore[] }>(`/rounds/${roundId}/confirm-scorecard`, {
      method: "POST",
      body: JSON.stringify({ scores }),
    }, token),
};

// Types
export interface User {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  avatarUrl?: string;
  phone?: string;
  ghinNumber?: string;
  handicapIndex?: number;
  handicapVerifiedAt?: string;
  handicapSource?: HandicapSource;
  handicapPendingApproval?: boolean;
  stripeCustomerId?: string;
  subscriptionStatus: "FREE" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "FOUNDING";
  isFoundingMember: boolean;
  onboardingComplete: boolean;
}

export interface Round {
  id: string;
  courseId: string;
  teeId: string;
  date: string;
  status: "SETUP" | "ACTIVE" | "COMPLETED";
  inviteCode: string;
  createdById: string;
  _count?: {
    players: number;
  };
}

export interface RoundDetail extends Round {
  course: CourseDetail;
  tee: Tee;
  players: RoundPlayer[];
  games: Game[];
}

export interface RoundPlayer {
  id: string;
  userId: string;
  courseHandicap?: number;
  position: number;
  user: User;
  scores?: HoleScore[];
}

export interface Course {
  id: string;
  name: string;
  city?: string;
  state?: string;
  country: string;
  latitude?: number;
  longitude?: number;
  logoUrl?: string;
  website?: string;
  heroImageUrl?: string;
  isVerified: boolean;
}

export interface CourseWithMeta extends Course {
  tees?: Tee[];
  roundCount?: number;
  distance?: number;
}

export interface DiscoverCoursesResponse {
  nearby: CourseWithMeta[];
  homeCourses: CourseWithMeta[];
  featured: CourseWithMeta[];
}

export interface CourseDetail extends Course {
  tees: Tee[];
  holes: Hole[];
}

export interface Tee {
  id: string;
  courseId: string;
  name: string;
  color?: string;
  slopeRating?: number;
  courseRating?: number;
  totalYardage?: number;
}

export interface Hole {
  id: string;
  courseId: string;
  holeNumber: number;
  par: number;
  handicapRank: number;
}

export interface HoleScore {
  id: string;
  roundPlayerId: string;
  holeNumber: number;
  strokes?: number;
  putts?: number;
}

export interface Game {
  id: string;
  roundId: string;
  type: GameType;
  betAmount: number;
  isAutoPress: boolean;
}

export type GameType =
  | "NASSAU"
  | "SKINS"
  | "MATCH_PLAY"
  | "WOLF"
  | "NINES"
  | "STABLEFORD"
  | "BINGO_BANGO_BONGO"
  | "VEGAS"
  | "SNAKE"
  | "BANKER";

export interface GameResult {
  id: string;
  gameId: string;
  roundPlayerId: string;
  segment?: string;
  netAmount: number;
}

export interface CalculateResultsResponse {
  roundId: string;
  games: Game[];
  results: {
    nassau?: {
      front: { winnerId: string | null; margin: number };
      back: { winnerId: string | null; margin: number };
      overall: { winnerId: string | null; margin: number };
      betAmount: number;
    };
    skins?: {
      skins: { hole: number; winnerId: string | null; value: number }[];
      totalPot: number;
    };
    matchPlay?: {
      standings: { userId: string; money: number }[];
    };
    wolf?: {
      standings: { userId: string; points: number }[];
    };
    nines?: {
      standings: { userId: string; totalMoney: number }[];
    };
    stableford?: {
      standings: { userId: string; money: number }[];
    };
    bingoBangoBongo?: {
      standings: { userId: string; money: number }[];
    };
    vegas?: {
      teams: { money: number }[];
    };
    snake?: {
      standings: { userId: string; money: number }[];
    };
    banker?: {
      standings: { userId: string; money: number }[];
    };
  };
  presses: Press[];
}

export interface BillingStatus {
  status: "FREE" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "FOUNDING";
  endsAt?: string;
  isFoundingMember: boolean;
}

export interface ApiSettlement {
  id: string;
  roundId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  status: "PENDING" | "PAID" | "DISPUTED";
  paidAt?: string;
  fromUser: {
    id: string;
    displayName: string | null;
    firstName: string | null;
    paymentMethods: PaymentMethod[];
  };
  toUser: {
    id: string;
    displayName: string | null;
    firstName: string | null;
    paymentMethods: PaymentMethod[];
  };
}

export interface Invite {
  id: string;
  code: string;
  roundId?: string;
  inviterId: string;
  status: "PENDING" | "ACCEPTED" | "EXPIRED";
}

export interface InviteDetails {
  code: string;
  redirectCode?: string; // Present when user used round ID instead of inviteCode
  inviter: {
    displayName: string;
    avatarUrl?: string;
  };
  round?: {
    id: string;
    date: string;
    course: {
      name: string;
      city?: string;
      state?: string;
    };
    games: {
      type: GameType;
      betAmount: number;
    }[];
    playerCount: number;
  };
}

export interface CreateRoundInput {
  courseId: string;
  teeId: string;
  date?: string;
}

export interface CreateCourseInput {
  name: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  holes: {
    holeNumber: number;
    par: number;
    handicapRank: number;
    yardages?: { teeName: string; yardage: number }[];
  }[];
  tees: {
    name: string;
    color?: string;
    slopeRating?: number;
    courseRating?: number;
    totalYardage?: number;
  }[];
}

export interface ScrapedCourseData {
  name: string;
  city?: string;
  state?: string;
  country?: string;
  website?: string;
  confidence?: string;
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

export interface AddGameInput {
  type: GameType;
  betAmount: number;
  isAutoPress?: boolean;
}

export interface UpdateScoreInput {
  holeNumber: number;
  strokes?: number;
  putts?: number;
  playerId?: string;
}

export interface CreateInviteInput {
  roundId?: string;
  email?: string;
  phone?: string;
  type?: "ROUND" | "BUDDY"; // BUDDY = buddy-only invite without a round
}

// Press types
export type PressSegment = "FRONT" | "BACK" | "OVERALL" | "MATCH";
export type PressStatusType = "ACTIVE" | "WON" | "LOST" | "PUSHED" | "CANCELED";

export interface Press {
  id: string;
  gameId: string;
  segment: PressSegment;
  startHole: number;
  initiatedById: string;
  status: PressStatusType;
  parentPressId?: string;
  betMultiplier: number;
  createdAt: string;
  childPresses?: Press[];
  results?: PressResult[];
}

export interface PressResult {
  id: string;
  pressId: string;
  roundPlayerId: string;
  netAmount: number;
}

export interface CreatePressInput {
  segment: PressSegment;
  startHole: number;
  parentPressId?: string;
  betMultiplier?: number;
}

export interface PressStatus {
  gameId: string;
  gameType: string;
  isAutoPress: boolean;
  segments: PressSegmentStatus[];
}

export interface PressSegmentStatus {
  segment: string;
  currentScore: number;
  holesPlayed: number;
  holesRemaining: number;
  canPress: boolean;
  activePresses: ActivePressStatus[];
  suggestAutoPress: boolean;
  autoPressHole: number | null;
}

export interface ActivePressStatus {
  id: string;
  startHole: number;
  currentScore: number;
  holesPlayed: number;
  holesRemaining: number;
  canPressThePress: boolean;
}

// Game live status types (for scorecard display)
export interface GameLiveStatus {
  gameId: string;
  type: string;
  betAmount: number;
  isAutoPress?: boolean;
  nassauStatus?: {
    front: { score: number; label: string; holesPlayed: number; holesRemaining: number };
    back: { score: number; label: string; holesPlayed: number; holesRemaining: number };
    overall: { score: number; label: string; holesPlayed: number; holesRemaining: number };
  };
  skinsStatus?: {
    skinsWon: number;
    skinsLost: number;
    carryover: number;
    potentialWinnings: number;
    playerResults?: Array<{
      userId: string;
      name: string;
      skinsWon: number;
      holesWon: number[];
      netAmount: number;
    }>;
  };
  wolfStatus?: {
    points: number;
    nextPickHole?: number;
  };
  stablefordStatus?: {
    points: number;
  };
  description?: string;
}

// Buddy types
export interface Buddy {
  id: string;
  displayName: string;
  nickname?: string;
  user: {
    id: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
    handicapIndex?: number;
  };
  sourceType: "INVITE" | "ROUND" | "MANUAL";
  createdAt: string;
}

// Handicap types
export type HandicapSource = "GHIN" | "USGA" | "CLUB" | "MANUAL" | "OTHER";
export type HandicapStatus = "none" | "verified" | "manual_pending" | "expired";
export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface HandicapStatusResponse {
  handicapIndex: number | null;
  source: HandicapSource | null;
  verifiedAt: string | null;
  status: HandicapStatus;
  isExpired: boolean;
  daysUntilExpiry: number | null;
}

export interface ExtractedHandicap {
  handicapIndex: number;
  source: HandicapSource;
  confidence: "high" | "medium" | "low";
  proofUrl?: string | null;
}

export interface ScorecardExtraction {
  imageUrl: string | null;
  playerName: string | null;
  extractedScores: {
    holeNumber: number;
    strokes: number;
    confidence: "high" | "medium" | "low";
  }[];
  needsReview: boolean;
}

export interface HandicapApproval {
  id: string;
  handicap: number;
  createdAt: string;
  user: {
    id: string;
    name: string;
    avatarUrl?: string;
  };
  round: {
    id: string;
    date: string;
    courseName: string;
  };
}

export interface ApprovalRequest {
  id: string;
  status: ApprovalStatus;
  needsApproval: boolean;
  message: string;
}

// Payment Method types
export type PaymentMethodType = "VENMO" | "ZELLE" | "CASHAPP" | "APPLE_PAY";

export interface PaymentMethod {
  id: string;
  userId: string;
  type: PaymentMethodType;
  handle: string;
  isPreferred: boolean;
  createdAt: string;
}
