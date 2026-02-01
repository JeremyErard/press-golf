import webpush from "web-push";
import { prisma } from "./prisma.js";

// VAPID keys for web push
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:support@pressgolf.app";

// Initialize web-push with VAPID keys
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Notification types that match the service worker
export type NotificationType =
  | "round_invite"
  | "game_invite"
  | "score_update"
  | "tee_time_reminder"
  | "settlement"
  | "challenge";

interface NotificationPayload {
  type: NotificationType;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: {
    url?: string;
    roundId?: string;
    gameId?: string;
    [key: string]: string | undefined;
  };
}

// Check if notifications are configured
export function isNotificationsConfigured(): boolean {
  return Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
}

// Get the VAPID public key for the frontend
export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

// Send a notification to a specific user
export async function sendNotificationToUser(
  userId: string,
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!isNotificationsConfigured()) {
    console.warn("[Notifications] VAPID keys not configured, skipping notification");
    return { sent: 0, failed: 0 };
  }

  // Check user's notification preferences
  const prefs = await prisma.notificationPreferences.findUnique({
    where: { userId },
  });

  // Check if user has disabled this notification type
  if (prefs) {
    const typeToPreference: Record<NotificationType, keyof typeof prefs> = {
      round_invite: "roundInvites",
      game_invite: "gameInvites",
      score_update: "scoreUpdates",
      tee_time_reminder: "teeTimeReminders",
      settlement: "settlementUpdates",
      challenge: "gameInvites", // Challenges use same preference as game invites
    };

    const prefKey = typeToPreference[payload.type];
    if (prefKey && !prefs[prefKey]) {
      console.log(`[Notifications] User ${userId} has disabled ${payload.type} notifications`);
      return { sent: 0, failed: 0 };
    }
  }

  // Get all push subscriptions for this user
  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId },
  });

  if (subscriptions.length === 0) {
    console.log(`[Notifications] No subscriptions found for user ${userId}`);
    return { sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  // Send to all subscriptions
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        },
        JSON.stringify(payload)
      );
      sent++;
    } catch (error: unknown) {
      failed++;
      const webPushError = error as { statusCode?: number };

      // If subscription is expired or invalid, remove it
      if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
        console.log(`[Notifications] Removing expired subscription ${sub.id}`);
        await prisma.pushSubscription.delete({ where: { id: sub.id } });
      } else {
        console.error(`[Notifications] Failed to send to subscription ${sub.id}:`, error);
      }
    }
  }

  return { sent, failed };
}

// Send notification to multiple users
export async function sendNotificationToUsers(
  userIds: string[],
  payload: NotificationPayload
): Promise<{ sent: number; failed: number }> {
  let totalSent = 0;
  let totalFailed = 0;

  for (const userId of userIds) {
    const result = await sendNotificationToUser(userId, payload);
    totalSent += result.sent;
    totalFailed += result.failed;
  }

  return { sent: totalSent, failed: totalFailed };
}

// ============================================================================
// Specific notification helpers
// ============================================================================

export async function notifyRoundInvite(
  inviteeUserId: string,
  inviterName: string,
  courseName: string,
  roundId: string
): Promise<void> {
  await sendNotificationToUser(inviteeUserId, {
    type: "round_invite",
    title: "Round Invite",
    body: `${inviterName} invited you to play at ${courseName}`,
    data: {
      url: `/round/${roundId}`,
      roundId,
    },
  });
}

export async function notifyGameInvite(
  playerUserIds: string[],
  creatorName: string,
  gameType: string,
  roundId: string,
  gameId: string
): Promise<void> {
  await sendNotificationToUsers(playerUserIds, {
    type: "game_invite",
    title: "Game Challenge",
    body: `${creatorName} started a ${gameType} game`,
    data: {
      url: `/round/${roundId}`,
      roundId,
      gameId,
    },
  });
}

export async function notifyScoreUpdate(
  playerUserIds: string[],
  updaterName: string,
  holeNumber: number,
  roundId: string
): Promise<void> {
  await sendNotificationToUsers(playerUserIds, {
    type: "score_update",
    title: "Score Update",
    body: `${updaterName} scored on hole ${holeNumber}`,
    tag: `score-${roundId}-${holeNumber}`, // Group by hole to prevent spam
    data: {
      url: `/round/${roundId}/play`,
      roundId,
    },
  });
}

export async function notifyTeeTimeReminder(
  playerUserId: string,
  courseName: string,
  teeTime: Date,
  roundId: string
): Promise<void> {
  const timeStr = teeTime.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  await sendNotificationToUser(playerUserId, {
    type: "tee_time_reminder",
    title: "Tee Time Reminder",
    body: `Your round at ${courseName} starts at ${timeStr}`,
    data: {
      url: `/round/${roundId}`,
      roundId,
    },
  });
}

export async function notifySettlementUpdate(
  userId: string,
  otherPlayerName: string,
  amount: number,
  isOwed: boolean,
  roundId: string
): Promise<void> {
  const formattedAmount = Math.abs(amount).toFixed(2);
  const body = isOwed
    ? `You owe ${otherPlayerName} $${formattedAmount}`
    : `${otherPlayerName} owes you $${formattedAmount}`;

  await sendNotificationToUser(userId, {
    type: "settlement",
    title: "Settlement Update",
    body,
    data: {
      url: `/rounds/${roundId}/settlement`,
      roundId,
    },
  });
}

export async function notifyPaymentSent(
  recipientUserId: string,
  payerName: string,
  amount: number,
  roundId: string
): Promise<void> {
  const formattedAmount = amount.toFixed(2);

  await sendNotificationToUser(recipientUserId, {
    type: "settlement",
    title: "Payment Received",
    body: `${payerName} says they paid you $${formattedAmount}. Tap to confirm.`,
    data: {
      url: `/rounds/${roundId}/settlement`,
      roundId,
    },
  });
}

export async function notifyPlayerJoinedRound(
  roundCreatorUserId: string,
  joinerName: string,
  courseName: string,
  roundId: string
): Promise<void> {
  await sendNotificationToUser(roundCreatorUserId, {
    type: "round_invite",
    title: "Player Joined",
    body: `${joinerName} joined your round at ${courseName}`,
    data: {
      url: `/rounds/${roundId}`,
      roundId,
    },
  });
}

export async function notifyChallengeReceived(
  challengedUserId: string,
  challengerName: string,
  gameType: string,
  betAmount: number,
  challengeId: string
): Promise<void> {
  await sendNotificationToUser(challengedUserId, {
    type: "challenge",
    title: "New Challenge!",
    body: `${challengerName} challenged you to ${gameType} for $${betAmount}`,
    data: {
      url: `/challenges`,
      challengeId,
    },
  });
}

export async function notifyChallengeAccepted(
  challengerUserId: string,
  challengedName: string,
  gameType: string,
  challengeId: string
): Promise<void> {
  await sendNotificationToUser(challengerUserId, {
    type: "challenge",
    title: "Challenge Accepted!",
    body: `${challengedName} accepted your ${gameType} challenge`,
    data: {
      url: `/challenges`,
      challengeId,
    },
  });
}

export async function notifyChallengeDeclined(
  challengerUserId: string,
  challengedName: string,
  gameType: string,
  challengeId: string
): Promise<void> {
  await sendNotificationToUser(challengerUserId, {
    type: "challenge",
    title: "Challenge Declined",
    body: `${challengedName} declined your ${gameType} challenge`,
    data: {
      url: `/challenges`,
      challengeId,
    },
  });
}
