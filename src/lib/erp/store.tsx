import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { ROLES, type RoleId, type RoleConfig } from "./config";
import { WORKSPACES, type Row } from "./workspaces";
import {
  AuthService,
  type UserProfile,
  type LoginCredentials,
  type RegisterPayload,
  type RegisterTenantPayload,
  type AuthResponse,
} from "./auth";
import {
  getRowsFn,
  addRowFn,
  deleteRowFn,
  resetRowsFn,
} from "@/lib/mongodb/serverFns/rows";
import { getClinicConfigFn } from "@/lib/mongodb/serverFns/clinicConfig";

export interface ClinicBranding {
  clinicName: string;
  tagline?: string;
  logoUrl?: string;
  primaryColor?: string;
  doctorName?: string;
}

// ─── Types ───────────────────────────────────────────────────────────────────

type RowStore = Record<string, Row[]>;

interface ErpContextValue {
  roleId: RoleId;
  setRoleId: (r: RoleId) => void;
  role: RoleConfig;
  currentUser: UserProfile | null;
  clinicBranding: ClinicBranding | null;
  isAuthenticated: boolean;
  isLoadingAuth: boolean;
  login: (credentials: LoginCredentials) => Promise<AuthResponse>;
  register: (payload: RegisterPayload) => Promise<AuthResponse>;
  registerTenant: (payload: RegisterTenantPayload) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  getRows: (moduleId: string) => Row[];
  addRow: (moduleId: string, row: Row) => Promise<void>;
  deleteRow: (moduleId: string, index: number) => Promise<void>;
  resetRows: (moduleId: string) => Promise<void>;
}

const defaultErpContext: ErpContextValue = {
  roleId: "admin",
  setRoleId: () => {},
  role: ROLES.admin,
  currentUser: null,
  clinicBranding: null,
  isAuthenticated: false,
  isLoadingAuth: false,
  login: async () => ({ success: false, message: "Not available outside ErpProvider" }),
  register: async () => ({ success: false, message: "Not available outside ErpProvider" }),
  registerTenant: async () => ({ success: false, message: "Not available outside ErpProvider" }),
  logout: async () => {},
  getRows: (moduleId: string) => WORKSPACES[moduleId]?.rows ?? [],
  addRow: async () => {},
  deleteRow: async () => {},
  resetRows: async () => {},
};

const ErpContext = createContext<ErpContextValue>(defaultErpContext);

// ─── ErpProvider ─────────────────────────────────────────────────────────────

export function ErpProvider({ children }: { children: ReactNode }) {
  const [roleId, setRoleIdState] = useState<RoleId>("doctor");
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [clinicBranding, setClinicBranding] = useState<ClinicBranding | null>(null);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  // Row cache: moduleId → Row[]
  const [rowCache, setRowCache] = useState<RowStore>({});

  const loadClinicBranding = useCallback(async () => {
    try {
      const config = await getClinicConfigFn();
      setClinicBranding(config as ClinicBranding | null);
    } catch {
      setClinicBranding(null);
    }
  }, []);

  // On mount: re-hydrate session from the httpOnly refresh cookie via server fn
  useEffect(() => {
    AuthService.getCurrentUserAsync()
      .then((user) => {
        if (user) {
          setCurrentUser(user);
          setRoleIdState(user.roleId);
          void loadClinicBranding();
        }
      })
      .catch(() => { /* network error — stay logged out */ })
      .finally(() => setIsLoadingAuth(false));
  }, [loadClinicBranding]);

  // ─── Role ───────────────────────────────────────────────────────────────

  const setRoleId = useCallback((r: RoleId) => {
    setRoleIdState(r);
  }, []);

  // ─── Auth ───────────────────────────────────────────────────────────────

  const login = useCallback(async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const res = await AuthService.login(credentials);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setRoleIdState(res.user.roleId);
      void loadClinicBranding();
    }
    return res;
  }, [loadClinicBranding]);

  const register = useCallback(async (payload: RegisterPayload): Promise<AuthResponse> => {
    const res = await AuthService.register(payload);
    if (res.success && res.user && !res.pendingApproval) {
      setCurrentUser(res.user);
      setRoleIdState(res.user.roleId);
    }
    return res;
  }, []);

  const registerTenant = useCallback(async (payload: RegisterTenantPayload): Promise<AuthResponse> => {
    const res = await AuthService.registerTenant(payload);
    if (res.success && res.user) {
      setCurrentUser(res.user);
      setRoleIdState(res.user.roleId);
      void loadClinicBranding();
    }
    return res;
  }, [loadClinicBranding]);


  const logout = useCallback(async (): Promise<void> => {
    await AuthService.logout();
    setCurrentUser(null);
    setClinicBranding(null);
    setRowCache({});
  }, [setRowCache]);

  // ─── Rows (MongoDB-backed) ───────────────────────────────────────────────

  const getRows = useCallback(
    (moduleId: string): Row[] => {
      // Return cached rows; if not yet fetched, return static seed for instant render
      if (rowCache[moduleId]) return rowCache[moduleId];
      // Kick off async fetch to populate cache
      getRowsFn({ data: { moduleId } })
        .then((rows) => setRowCache((prev) => ({ ...prev, [moduleId]: rows })))
        .catch(() => { /* fallback to static */ });
      return WORKSPACES[moduleId]?.rows ?? [];
    },
    [rowCache]
  );

  const addRow = useCallback(
    async (moduleId: string, row: Row): Promise<void> => {
      // Optimistic update
      setRowCache((prev) => ({
        ...prev,
        [moduleId]: [row, ...(prev[moduleId] ?? WORKSPACES[moduleId]?.rows ?? [])],
      }));
      // Persist to MongoDB
      await addRowFn({ data: { moduleId, row } });
    },
    []
  );

  const deleteRow = useCallback(
    async (moduleId: string, index: number): Promise<void> => {
      // Optimistic update
      setRowCache((prev) => {
        const current = prev[moduleId] ?? WORKSPACES[moduleId]?.rows ?? [];
        return { ...prev, [moduleId]: current.filter((_, i) => i !== index) };
      });
      // Persist to MongoDB
      await deleteRowFn({ data: { moduleId, index } });
    },
    []
  );

  const resetRows = useCallback(
    async (moduleId: string): Promise<void> => {
      // Optimistic update — restore to static seed
      const seed = WORKSPACES[moduleId]?.rows ?? [];
      setRowCache((prev) => ({ ...prev, [moduleId]: seed }));
      // Persist to MongoDB
      await resetRowsFn({ data: { moduleId } });
    },
    []
  );

  // ─── Computed role config ────────────────────────────────────────────────

  const activeRoleConfig = useMemo(() => {
    const base = ROLES[roleId] ?? ROLES.admin;
    if (currentUser && currentUser.roleId === roleId) {
      return {
        ...base,
        person:       currentUser.fullName,
        initials:     currentUser.initials,
        scope:        currentUser.branch,
        scopeCaption: currentUser.clinicName,
      };
    }
    return base;
  }, [roleId, currentUser]);

  // ─── Context value ───────────────────────────────────────────────────────

  const value = useMemo<ErpContextValue>(
    () => ({
      roleId,
      setRoleId,
      role:            activeRoleConfig,
      currentUser,
      clinicBranding,
      isAuthenticated: Boolean(currentUser),
      isLoadingAuth,
      login,
      register,
      registerTenant,
      logout,
      getRows,
      addRow,
      deleteRow,
      resetRows,
    }),
    [roleId, setRoleId, activeRoleConfig, currentUser, clinicBranding, isLoadingAuth, login, register, registerTenant, logout, getRows, addRow, deleteRow, resetRows]
  );

  return <ErpContext.Provider value={value}>{children}</ErpContext.Provider>;
}

export function useErp() {
  const ctx = useContext(ErpContext);
  return ctx ?? defaultErpContext;
}


