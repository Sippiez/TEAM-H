"use client";

import { useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "cn";
import { usePanelRef } from "react-resizable-panels";

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
  const fieldsPanel = usePanelRef();
  const [fieldsCollapsed, setFieldsCollapsed] = useState(false);
  if (!desktop) return <>{children}</>;

  const [route, viewer, details] = children;
  return (
    <ResizablePanelGroup orientation="horizontal" className="min-h-0 flex-1">
      <ResizablePanel
        id="workspace-fields"
        panelRef={fieldsPanel}
        collapsible
        collapsedSize="52px"
        defaultSize="300px"
        minSize="220px"
        maxSize="35%"
        groupResizeBehavior="preserve-pixel-size"
        onResize={() => {
          if (fieldsPanel.current) setFieldsCollapsed(fieldsPanel.current.isCollapsed());
        }}
        className="min-h-0 min-w-0"
      >
        <div className={cn("relative h-full bg-desk", fieldsCollapsed && "border-r border-rule")}>
          <button
            type="button"
            aria-label={fieldsCollapsed ? t.expandFieldsPanel : t.collapseFieldsPanel}
            title={fieldsCollapsed ? t.expandFieldsPanel : t.collapseFieldsPanel}
            aria-expanded={!fieldsCollapsed}
            aria-controls="workspace-fields-content"
            onClick={() => {
              if (fieldsPanel.current?.isCollapsed()) fieldsPanel.current.expand();
              else fieldsPanel.current?.collapse();
            }}
            className={cn(
              "absolute top-2 z-20 flex size-11 cursor-pointer items-center justify-center rounded-md text-ink hover:bg-hover-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
              fieldsCollapsed ? "right-1" : "right-2",
            )}
          >
            {fieldsCollapsed ? <PanelLeftOpen aria-hidden="true" size={20} /> : <PanelLeftClose aria-hidden="true" size={20} />}
          </button>
          <div id="workspace-fields-content" hidden={fieldsCollapsed} className="h-full [&>nav]:h-full">
            {route}
          </div>
        </div>
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
