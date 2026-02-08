"use client";

import { Toaster as SonnerToaster, toast } from "sonner";

// Workaround for React/Next.js typing issues
const ToasterComponent = SonnerToaster as unknown as React.FC<{
  theme?: "dark" | "light" | "system";
  position?: "top-left" | "top-center" | "top-right" | "bottom-left" | "bottom-center" | "bottom-right";
  toastOptions?: {
    classNames?: {
      toast?: string;
      title?: string;
      description?: string;
      actionButton?: string;
      cancelButton?: string;
      success?: string;
      error?: string;
      warning?: string;
      info?: string;
    };
  };
}>;

function Toaster() {
  return (
    <ToasterComponent
      theme="dark"
      position="bottom-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast bg-surface border-border shadow-lg rounded-lg p-4",
          title: "text-foreground font-medium",
          description: "text-muted text-sm",
          actionButton: "bg-brand text-white",
          cancelButton: "bg-surface-elevated text-foreground",
          success: "border-success/50",
          error: "border-error/50",
          warning: "border-warning/50",
          info: "border-brand/50",
        },
      }}
    />
  );
}

export { Toaster, toast };
