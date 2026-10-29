"use client";

import type { ReactNode } from "react";

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";

import { useI18n } from "./i18n";

const handle =
  "z-20 w-2 bg-desk hover:bg-hover-wash focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink data-[separator=active]:bg-hover-wash [&>div]:bg-quiet-stroke";

export function WorkspacePanels({
  desktop,
  children,
}: {
  desktop: boolean;
  children: [ReactNode, ReactNode, ReactNode];
}) {
  const { t } = useI18n();
  if (!desktop) return <>{children}</>;

  const [route, viewer, details] = children;
  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel
        id="workspace-fields"
        defaultSize="300px"
        minSize="220px"
        maxSize="35%"
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0 [&>nav]:h-full"
      >
        {route}
      </ResizablePanel>
      <ResizableHandle withHandle aria-label={t.resizeFieldsPanel} className={handle} />
      <ResizablePanel
        id="workspace-document"
        minSize="280px"
        className="min-h-0 min-w-0 [&>section]:h-full"
      >
        {viewer}
      </ResizablePanel>
      <ResizableHandle withHandle aria-label={t.resizeDetailsPanel} className={handle} />
      <ResizablePanel
        id="workspace-details"
        defaultSize="456px"
        minSize="300px"
        maxSize="50%"
        groupResizeBehavior="preserve-pixel-size"
        className="min-h-0 min-w-0 [&>aside]:h-full"
      >
        {details}
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
