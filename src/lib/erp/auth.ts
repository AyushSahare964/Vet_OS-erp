/**
 * auth.ts — Client-facing auth API.
 *
 * All persistence is handled by MongoDB Atlas via TanStack Start
 * server functions.
 */

import { ROLES, type RoleId } from "./config";
import {
  loginFn,
  registerFn,
  sendEmailOtpFn,
  confirmEmailOtpFn,
  logoutFn,
  getMeFn,
  seedDemoUsersFn,
  clearAndReseedFn,
  checkStaffStatusFn,
  listStaffMembersFn,
  approveStaffMemberFn,
  rejectStaffMemberFn,
  createStaffMemberByAdminFn,
  updateStaffMemberFn,
  deleteStaffMemberFn,
} from "@/lib/mongodb/serverFns/auth";
import { registerTenantFn } from "@/lib/mongodb/serverFns/platform";

// ─── Shared interfaces ───────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone?: string;
  clinicName: string;
  branch: string;
  roleId: RoleId;
  roleName: string;
  initials: string;
  licenseNumber?: string;
  qualification?: string;
  department?: string;
  specialty?: "Canine" | "Feline" | "Avian" | "Exotic" | "Surgery" | "General Practice" | "Administration";
  avatarUrl?: string;
  approvalStatus?: "approved" | "pending" | "rejected";
  createdAt: string;
}

export interface RegisterPayload {
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  /** The clinic's tenant slug (e.g. "real_care_ngp") — staff join an existing clinic, they don't create one. */
  clinicSlug: string;
  roleId: RoleId;
  licenseNumber?: string;
  qualification?: string;
  department?: string;
  specialty?: "Canine" | "Feline" | "Avian" | "Exotic" | "Surgery" | "General Practice" | "Administration";
}

export interface LoginCredentials {
  email: string;
  password: string;
  rememberMe?: boolean;
}

export interface RegisterTenantPayload {
  clinicName: string;
  legalName?: string;
  clinicType: string;
  vetCouncilRegNo?: string;
  address: string;
  city: string;
  state: string;
  pin: string;
  phone: string;
  whatsappNumber?: string;
  email: string;
  website?: string;
  gstin?: string;
  pan?: string;
  isCompositionDealer?: boolean;
  planId: "plan_basic" | "plan_professional" | "plan_enterprise";
  adminFullName: string;
  adminEmail: string;
  adminPassword: string;
  adminPhone?: string;
  // Branding
  tagline?: string;
  primaryColor?: string;
  /** Data URI (data:image/...;base64,...) of the uploaded logo, client-resized before send. */
  logoDataUri?: string;
  hasBoardingFacility?: boolean;
  hasSwimmingPool?: boolean;
  kennelCapacity?: number;
}

export interface AuthResponse {
  success: boolean;
  user?: UserProfile;
  message?: string;
  token?: string;
  pendingApproval?: boolean;
}

// ─── In-memory session cache ────────────────────────────────────────────────
let _sessionCache: UserProfile | null = null;

// ─── AuthService ─────────────────────────────────────────────────────────────

export class AuthService {
  /**
   * Log in an ERP operator with email and password.
   */
  public static async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const res = await loginFn({ data: credentials });
    if (res.success && res.user) {
      _sessionCache = res.user;
      try {
        if (typeof sessionStorage !== "undefined" && res.accessToken) {
          sessionStorage.setItem("vetos.access_token", res.accessToken);
        }
      } catch { /* ignore */ }
    }
    const result: AuthResponse = {
      success: res.success,
    };
    if (res.pendingApproval !== undefined) result.pendingApproval = res.pendingApproval;
    if (res.user)    result.user    = res.user;
    if (res.message) result.message = res.message;
    if (res.accessToken) result.token = res.accessToken;
    return result;

  }

  /**
   * Register a new ERP operator profile (Submits for admin approval).
   */
  public static async register(data: RegisterPayload): Promise<AuthResponse> {
    const res = await registerFn({ data });
    return res;
  }

  /** Email an OTP to prove address ownership before registering. */
  public static sendEmailOtp(email: string, name?: string) {
    return sendEmailOtpFn({ data: { email, ...(name ? { name } : {}) } });
  }

  public static confirmEmailOtp(email: string, code: string) {
    return confirmEmailOtpFn({ data: { email, code } });
  }

  /**
   * Self-service clinic (tenant) registration — provisions a brand new
   * isolated ERP workspace and immediately signs the founding admin in.
   */
  public static async registerTenant(data: RegisterTenantPayload): Promise<AuthResponse> {
    const res = await registerTenantFn({ data });
    if (res.success && res.user) {
      _sessionCache = res.user;
      try {
        if (typeof sessionStorage !== "undefined" && res.accessToken) {
          sessionStorage.setItem("vetos.access_token", res.accessToken);
        }
      } catch { /* ignore */ }
    }
    return res;
  }

  /**
   * Check live approval status by email.
   */
  public static async checkApprovalStatus(email: string) {
    return checkStaffStatusFn({ data: { email } });
  }

  /**
   * Get the current session user.
   */
  public static async getCurrentUserAsync(): Promise<UserProfile | null> {
    if (_sessionCache) return _sessionCache;
    try {
      const user = await getMeFn();
      _sessionCache = user;
      return user;
    } catch {
      return null;
    }
  }

  /**
   * Synchronous getter.
   */
  public static getCurrentUser(): UserProfile | null {
    return _sessionCache;
  }

  /**
   * Log out.
   */
  public static async logout(): Promise<void> {
    _sessionCache = null;
    try {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem("vetos.access_token");
      }
    } catch { /* ignore */ }
    await logoutFn();
  }

  /**
   * Seed system credentials (upsert only, does not wipe existing data).
   */
  public static async seedDemoUsers(): Promise<{ seeded: number; message: string }> {
    return seedDemoUsersFn();
  }

  /**
   * Clear ALL users from MongoDB, then re-seed the two default system credentials.
   * Call this from the Identity Hub to reset the staff directory.
   */
  public static async clearAndReseed(): Promise<{ deleted: number; seeded: number; message: string }> {
    return clearAndReseedFn();
  }

  /**
   * List all registered staff for Identity & Access Hub.
   */
  public static async listStaff(): Promise<any[]> {
    return listStaffMembersFn();
  }

  /**
   * Approve a pending staff member.
   */
  public static async approveStaff(data: { userId: string; roleId: RoleId; department?: string }) {
    return approveStaffMemberFn({ data });
  }

  /**
   * Reject a staff member's request.
   */
  public static async rejectStaff(data: { userId: string; reason?: string }) {
    return rejectStaffMemberFn({ data });
  }

  /**
   * Admin directly creates an approved employee.
   */
  public static async createStaffMember(data: any) {
    return createStaffMemberByAdminFn({ data });
  }

  /**
   * Update staff member profile and save to MongoDB.
   */
  public static async updateStaff(data: any) {
    return updateStaffMemberFn({ data });
  }

  /**
   * Delete staff member and their credentials from MongoDB.
   */
  public static async deleteStaff(data: { userId: string }) {
    return deleteStaffMemberFn({ data });
  }

  /**
   * Returns demo staff list (empty by default; staff accounts are created dynamically).
   */
  public static getDemoStaffList(): UserProfile[] {
    return [];
  }
}

export const INITIAL_SEED_USERS: UserProfile[] = [];
