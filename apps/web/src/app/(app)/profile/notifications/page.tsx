"use client";

import { Header } from "@/components/layout/header";
import { NotificationSettings } from "@/components/notifications";

export default function NotificationsPage() {
  return (
    <div className="pb-24">
      <Header title="Notifications" showBack />
      <div className="p-lg">
        <NotificationSettings />
      </div>
    </div>
  );
}
