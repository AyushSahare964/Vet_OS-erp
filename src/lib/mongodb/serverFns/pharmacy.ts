import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { nextSeq } from "./counters";

function toPlain<T>(v: any): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export const listRetailSalesFn = createServerFn({ method: "GET" })
  .handler(tenantScoped(async (): Promise<any[]> => {
    await connectDB();
    const docs = await ErpRow.find({ moduleId: "retail_sales" }).sort({ createdAt: -1 }).lean();
    return toPlain(docs.map((d) => d.data));
  }));

export const createRetailSaleFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.record(z.any()).parse(raw))
  .handler(tenantScoped(async ({ data }): Promise<any> => {
    await connectDB();
    // Bill number comes from a counter, so two counters billing at once never share a number.
    const bill = await nextSeq("retail_bill", "RET", 4);
    const doc = await ErpRow.create({
      moduleId: "retail_sales",
      data: { ...data, bill },
    });
    return toPlain(doc.data);
  }));
