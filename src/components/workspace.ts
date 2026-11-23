import { useSyncExternalStore } from "react";
import { useOutletContext } from "react-router";

export type WorkspaceLayout = "phone" | "tablet" | "desktop";

export interface WorkspaceContext {
  layout: WorkspaceLayout;
  toolbar: HTMLDivElement | null;
}

const phone = "(max-width: 767.98px), (max-height: 480px) and (pointer: coarse)";
const desktop = "(min-width: 1100px) and (hover: hover) and (pointer: fine)";
const touch = "(any-pointer: coarse)";

export const workspaceTransitions = typeof document !== "undefined" &&
  typeof document.startViewTransition === "function" && CSS.supports("selector(:active-view-transition)");

function subscribe(listener: () => void) {
  const queries = [phone, desktop, touch].map((rule) => window.matchMedia(rule));
  for (const query of queries) query.addEventListener("change", listener);
  return () => {
    for (const query of queries) query.removeEventListener("change", listener);
  };
}

function currentLayout(): WorkspaceLayout {
  if (window.matchMedia(phone).matches) return "phone";
  return window.matchMedia(desktop).matches && !window.matchMedia(touch).matches ? "desktop" : "tablet";
}

export function useWorkspaceLayout() {
  return useSyncExternalStore(subscribe, currentLayout, () => "desktop" as const);
}

export function useWorkspace() {
  return useOutletContext<WorkspaceContext>();
}
