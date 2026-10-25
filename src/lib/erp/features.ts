/**
 * Subscription tiers and feature gating — the PRD's §6 matrix.
 *
 * ponytail: no Razorpay integration (no live payment provider key available),
 * so every plan choice at registration starts a TRIAL_DAYS trial with the chosen
 * plan's features active immediately — no payment step blocks first use.
 * Add real recurring billing when a Razorpay key is provided.
 */

import type { SubscriptionPlanId, TenantFeatures } from "@/lib/mongodb/models/Tenant";

/** Trial length for every plan: the landing page promises this number, so change it here only. */
export const TRIAL_DAYS = 30;

/** GST added on top of a paid plan's price. */
export const PLAN_GST_RATE = 0.18;

/** What the customer pays for a plan, in paise (price + GST). */
export const planChargePaise = (id: SubscriptionPlanId): number =>
  Math.round(SUBSCRIPTION_PLANS[id].monthlyPriceInr * (1 + PLAN_GST_RATE) * 100);

/** Every plan includes every module; plans differ only in staff and pet limits. */
const ALL_MODULES = {
  crm: true, appointments: true, clinical: true, billing: true, inventory: true,
  laboratory: true, pharmacy: true, boarding: true, accounting: true, reports: true, nutrition: true,
};

export interface SubscriptionPlan {
  planId: SubscriptionPlanId;
  name: string;
  monthlyPriceInr: number;
  features: TenantFeatures;
}

/**
 * Public plans match the landing page: Starter (free trial), Pro (Rs 1,999/mo), Max (coming soon).
 * plan_basic is no longer offered but stays so tenants created earlier keep working.
 */
export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlan> = {
  plan_starter: {
    planId: "plan_starter",
    name: "Starter",
    monthlyPriceInr: 0,
    features: { ...ALL_MODULES, maxUsers: 5, maxPets: 500 },
  },
  plan_basic: {
    planId: "plan_basic",
    name: "Basic",
    monthlyPriceInr: 999,
    features: { ...ALL_MODULES, maxUsers: 5, maxPets: 500 },
  },
  plan_professional: {
    planId: "plan_professional",
    name: "Pro",
    monthlyPriceInr: 1999,
    features: { ...ALL_MODULES, maxUsers: 20, maxPets: 5000 },
  },
  plan_enterprise: {
    planId: "plan_enterprise",
    name: "Max",
    monthlyPriceInr: 0, // not on sale yet ("coming soon"); existing enterprise tenants keep unlimited access
    features: { ...ALL_MODULES, maxUsers: -1, maxPets: -1 },
  },
};

/** Module id (as used in erp/config.ts flashcards) -> feature flag that gates it. */
const MODULE_FEATURE_GATE: Record<string, keyof TenantFeatures> = {
  laboratory: "laboratory",
  pharmacy: "pharmacy",
  boarding: "boarding",
  accounting: "accounting",
  accounts: "accounting",
  nutrition: "nutrition",
  reports: "reports",
};

export function isModuleEnabled(moduleId: string, features: TenantFeatures): boolean {
  const gate = MODULE_FEATURE_GATE[moduleId];
  if (!gate) return true; // no gate = always visible (crm, appointments, clinical, billing, inventory, identity)
  return Boolean(features[gate]);
}

export function assertFeatureEnabled(features: TenantFeatures, feature: keyof TenantFeatures): void {
  if (!features[feature]) {
    throw new Error(`Feature '${String(feature)}' is not included in your current subscription plan.`);
  }
}
