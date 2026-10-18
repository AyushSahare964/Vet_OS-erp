// The two bars read their items from menuConfig.ts (single source of truth); this file only applies the
// signed-in role: it keeps items the role may see and never widens what the role could open before.
import { baseModuleIds, type RoleConfig } from "@/lib/erp/config";
import { menuFor, type MenuItem } from "./menuConfig";

export type BarItem = MenuItem;

/** Left and right bar items for a role, plus the module ids the role holds (used by the Quick Action flyout). */
export function barItemsFor(role: RoleConfig): { left: BarItem[]; right: BarItem[]; held: Set<string> } {
  const held = baseModuleIds(role);
  return { ...menuFor(role.id, held), held };
}
