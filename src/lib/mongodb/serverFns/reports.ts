import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export const listClinicalReportsFn = createServerFn({ method: "GET" })
  .handler(tenantScoped(async (): Promise<any[]> => {
    await connectDB();
    const docs = await ErpRow.find({ moduleId: "clinical_reports" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data));
  }));

export const createClinicalReportFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.record(z.any()).parse(raw))
  .handler(tenantScoped(async ({ data }): Promise<any> => {
    await connectDB();
    const doc = await ErpRow.create({
      moduleId: "clinical_reports",
      data,
    });
    return toPlain(doc.data);
  }));

export const deleteClinicalReportFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ reportId: z.string() }).parse(raw))
  .handler(tenantScoped(async ({ data }): Promise<boolean> => {
    await connectDB();
    await ErpRow.findOneAndDelete({ moduleId: "clinical_reports", "data.reportId": data.reportId });
    return true;
  }));
