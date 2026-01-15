"use client";

import { Sheet, SheetContent, SheetHeader, SheetTitle, Button } from "@/components/ui";
import { tabHelpContent, type TabHelpContent } from "@/lib/tab-help-content";

interface TabHelpSheetProps {
  tabKey: keyof typeof tabHelpContent;
  open: boolean;
  onClose: () => void;
}

export function TabHelpSheet({ tabKey, open, onClose }: TabHelpSheetProps) {
  const content: TabHelpContent = tabHelpContent[tabKey];

  if (!content) return null;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="max-h-[70vh]">
        <SheetHeader>
          <SheetTitle>{content.title}</SheetTitle>
        </SheetHeader>

        <div className="px-5 pb-6 space-y-4">
          {content.items.map((item, index) => (
            <div key={index} className="flex gap-3">
              <div className="w-2 h-2 rounded-full bg-brand mt-2 flex-shrink-0" />
              <div>
                <p className="text-white font-medium">{item.title}</p>
                <p className="text-muted text-sm mt-0.5">{item.description}</p>
              </div>
            </div>
          ))}

          <div className="pt-4">
            <Button onClick={onClose} className="w-full">
              Got it
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
