/** Read-only list of this clinic's branches (tenant-scoped through tenantScoped + the model's tenant plugin). */
import { createServerFn } from "@tanstack/react-start";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { getTenantContext } from "@/lib/mongodb/tenantContext";
import { OrgBranchModel, getDefaultBranch } from "@/lib/mongodb/models/OrgBranch";

export interface BranchRow {
  code: string;
  name: string;
}

export const listBranchesFn = createServerFn({ method: "GET" }).handler(
  tenantScoped(async (): Promise<BranchRow[]> => {
    await connectDB();
    // Without a tenant context a query would run unscoped, so refuse instead of returning other clinics' branches.
    if (!getTenantContext()?.tenantId) return [];
    const rows = await OrgBranchModel.find({ isActive: { $ne: false } }).sort({ code: 1 }).lean();
    return rows.map((b) => ({ code: String(b.code), name: String(b.name) }));
  }),
);

/** The clinic's own GST state code (seller side of the intra/inter-state decision). */
export const getBranchStateCodeFn = createServerFn({ method: "GET" }).handler(
  tenantScoped(async (): Promise<string> => {
    await connectDB();
    return (await getDefaultBranch()).stateCode;
  }),
);
