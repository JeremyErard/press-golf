import { prisma } from "./prisma.js";
import { notifyTeeTimeReminder } from "./notifications.js";

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const REMINDER_WINDOW_MS = 60 * 60 * 1000; // 1 hour before tee time

let intervalId: ReturnType<typeof setInterval> | null = null;

async function checkUpcomingTeeTimes(): Promise<void> {
  try {
    const now = new Date();
    const reminderCutoff = new Date(now.getTime() + REMINDER_WINDOW_MS);

    // Find tee time groups that:
    // 1. Haven't had a reminder sent yet
    // 2. Are within the next hour
    // 3. Haven't already passed
    const groups = await prisma.teeTimeGroup.findMany({
      where: {
        reminderSent: false,
        teeTime: {
          gt: now,
          lte: reminderCutoff,
        },
      },
      include: {
        round: {
          include: {
            course: { select: { name: true } },
          },
        },
        players: {
          select: { userId: true },
        },
      },
    });

    if (groups.length === 0) return;

    console.log(`[TeeTimeScheduler] Found ${groups.length} upcoming tee times to notify`);

    for (const group of groups) {
      const courseName = group.round.course.name;

      // Send reminder to each player in the group
      const notifications = group.players.map((player) =>
        notifyTeeTimeReminder(player.userId, courseName, group.teeTime, group.roundId)
          .catch((err) => console.error(`[TeeTimeScheduler] Failed to notify user ${player.userId}:`, err))
      );

      await Promise.allSettled(notifications);

      // Mark as sent so we don't re-notify
      await prisma.teeTimeGroup.update({
        where: { id: group.id },
        data: { reminderSent: true },
      });
    }

    console.log(`[TeeTimeScheduler] Sent reminders for ${groups.length} tee time groups`);
  } catch (error) {
    console.error("[TeeTimeScheduler] Error checking upcoming tee times:", error);
  }
}

export function startTeeTimeScheduler(): void {
  if (intervalId) return; // Already running

  console.log("[TeeTimeScheduler] Starting tee time reminder scheduler (checks every 5 min)");

  // Run an initial check on startup
  checkUpcomingTeeTimes();

  // Then check every 5 minutes
  intervalId = setInterval(checkUpcomingTeeTimes, CHECK_INTERVAL_MS);
}

export function stopTeeTimeScheduler(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    console.log("[TeeTimeScheduler] Stopped tee time reminder scheduler");
  }
}
