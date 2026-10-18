// Tiny shared store: the Quick Action flyout (in the bar) asks, QuickActionHost (lazy, in SideBar) opens the modal.
import { useSyncExternalStore } from "react";
import type { QuickAction } from "./menuConfig";

type Id = QuickAction["id"] | null;
let current: Id = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const openQuickAction = (id: QuickAction["id"]) => {
  current = id;
  emit();
};
export const closeQuickAction = () => {
  current = null;
  emit();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export const useQuickAction = (): Id => useSyncExternalStore(subscribe, () => current, () => null);
