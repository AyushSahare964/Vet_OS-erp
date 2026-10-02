/**
 * Subscription tiers and feature gating — the PRD's §6 matrix.
 *
 * ponytail: no Razorpay integration (no live payment provider key available),
 * so every plan choice at registration starts a 14-day TRIAL with the chosen
 * plan's features active immediately — no payment step blocks first use.
 * Add real recurring billing when a Razorpay key is provided.
 */

import type { SubscriptionPlanId, TenantFeatures } from "@/lib/mongodb/models/Tenant";

export interface SubscriptionPlan {
  planId: SubscriptionPlanId;
  name: string;
  monthlyPriceInr: number;
  features: TenantFeatures;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanId, SubscriptionPlan> = {
  plan_basic: {
    planId: "plan_basic",
    name: "Basic",
    monthlyPriceInr: 999,
    features: {
      crm: true, appointments: true, clinical: true, billing: true, inventory: true,
      laboratory: false, pharmacy: false, boarding: false, accounting: false,
      reports: false, nutrition: false, maxUsers: 5, maxPets: 500,
    },
  },
  plan_professional: {
    planId: "plan_professional",
    name: "Professional",
    monthlyPriceInr: 2499,
    features: {
      crm: true, appointments: true, clinical: true, billing: true, inventory: true,
      laboratory: true, pharmacy: true, boarding: true, accounting: true,
      reports: true, nutrition: false, maxUsers: 20, maxPets: 5000,
    },
  },
  plan_enterprise: {
    planId: "plan_enterprise",
    name: "Enterprise",
    monthlyPriceInr: 5999,
    features: {
      crm: true, appointments: true, clinical: true, billing: true, inventory: true,
      laboratory: true, pharmacy: true, boarding: true, accounting: true,
      reports: true, nutrition: true, maxUsers: -1, maxPets: -1,
    },
  },
};

/** Module id (as used in erp/config.ts flashcards) -> feature flag that gates it. */
const MODULE_FEATURE_GATE: Record<string, keyof TenantFeatures> = {
  laboratory: "laboratory",
  pharmacy: "pharmacy",
  boarding: "boarding",
  accounting: "accounting",
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
