/**
 * Staff performance report (Admin only). Reads existing collections only; nothing is written.
 * Tenant scoping comes from tenantScoped() (every model query is filtered by the caller's tenant);
 * the role check uses that same resolved context, so a non-admin or unauthenticated caller is rejected here
 * even if the UI is bypassed.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB, tenantScoped } from "@/lib/mongodb/client";
import { getTenantContext } from "@/lib/mongodb/tenantContext";
import { User } from "@/lib/mongodb/models/User";
import { ClinicalVisit } from "@/lib/mongodb/models/ClinicalVisit";
import { SalesDocModel } from "@/lib/mongodb/models/SalesDoc";
import { PaymentDocModel } from "@/lib/mongodb/models/PaymentDoc";
import { ErpRow } from "@/lib/mongodb/models/ErpRow";
import { addDaysToISO, fiscalYearRange, todayIST } from "@/lib/utils/dateUtils";
import { roundMoney } from "@/lib/utils/moneyUtils";

export type StaffReportPreset = "month" | "last30" | "fy";

export interface StaffReportRow {
  id: string;
  fullName: string;
  roleId: string;
  roleName: string;
  /** Metric key -> value. Only the metrics that can be linked to this person for their role are present. */
  metrics: Record<string, number>;
  /** Comparable figures for the chart: money generated (Rs) and number of work items. */
  money: number;
  work: number;
}

export interface StaffReport {
  from: string;
  to: string;
  rows: StaffReportRow[];
  /** Metrics that cannot be reported because the data does not record who did the work. */
  skipped: string[];
}

const FINISHED = ["Paid", "Closed", "Billed", "Settled", "Completed"];

export const getStaffReportFn = createServerFn({ method: "GET" })
  .validator((raw: unknown) => z.object({ preset: z.enum(["month", "last30", "fy"]) }).parse(raw))
  .handler(
    tenantScoped(async ({ data }): Promise<StaffReport> => {
      await connectDB();
      const ctx = getTenantContext();
      if (!ctx?.tenantId || ctx.roleId !== "admin") {
        throw new Error("Only a clinic administrator can view staff reports.");
      }

      const to = todayIST();
      const from =
        data.preset === "month" ? `${to.slice(0, 8)}01` : data.preset === "last30" ? addDaysToISO(to, -29) : fiscalYearRange(to).from;
      const range = { $gte: from, $lte: to };

      const staff = await User.find({ isSystemAccount: { $ne: true }, approvalStatus: "approved" }).sort({ fullName: 1 }).lean();

      const [visits, invoices, payments, labs, appts] = await Promise.all([
        ClinicalVisit.find({ date: range }).select("visitId doctorName status").lean(),
        SalesDocModel.find({ docType: "INVOICE", status: "POSTED", docDate: range })
          .select("visitId grandTotal createdByName soldByStaffName")
          .lean(),
        PaymentDocModel.find({ direction: "IN", status: "POSTED", docDate: range }).select("totalAmount createdByName").lean(),
        ErpRow.find({ moduleId: "lab_orders", "data.date": range }).select("data.doctor").lean(),
        ErpRow.find({ moduleId: "appointments", $or: [{ "data.appointment_date": range }, { "data.date": range }] })
          .select("data.doctor data.status")
          .lean(),
      ]);

      // Revenue for a doctor = invoices tied to one of their visits (an invoice can sit on a visit outside the date range).
      const invoiceVisitIds = invoices.map((i) => i.visitId).filter((v): v is string => !!v);
      const visitDoctor = new Map<string, string>(
        (await ClinicalVisit.find({ visitId: { $in: invoiceVisitIds } }).select("visitId doctorName").lean()).map((v) => [
          String(v.visitId),
          String(v.doctorName),
        ]),
      );

      const rows: StaffReportRow[] = staff.map((u) => {
        const name = u.fullName;
        const metrics: Record<string, number> = {};
        let money = 0;
        let work = 0;
        if (u.roleId === "doctor") {
          metrics["visitsCompleted"] = visits.filter((v) => v.doctorName === name && FINISHED.includes(String(v.status))).length;
          metrics["revenue"] = roundMoney(
            invoices.filter((i) => i.visitId && visitDoctor.get(String(i.visitId)) === name).reduce((s, i) => s + Number(i.grandTotal ?? 0), 0),
          );
          metrics["labOrders"] = labs.filter((l) => (l.data as Record<string, unknown>)["doctor"] === name).length;
          const mine = appts.filter((a) => (a.data as Record<string, unknown>)["doctor"] === name);
          const st = (a: (typeof appts)[number]) => String((a.data as Record<string, unknown>)["status"] ?? "").toLowerCase();
          metrics["apptsCompleted"] = mine.filter((a) => st(a) === "completed").length;
          metrics["noShows"] = mine.filter((a) => st(a) === "no-show" || st(a) === "no show").length;
          money = metrics["revenue"];
          work = metrics["visitsCompleted"];
        } else if (u.roleId === "reception") {
          const mine = invoices.filter((i) => i.createdByName === name || i.soldByStaffName === name);
          metrics["invoicesCreated"] = mine.length;
          metrics["invoiceValue"] = roundMoney(mine.reduce((s, i) => s + Number(i.grandTotal ?? 0), 0));
          metrics["amountCollected"] = roundMoney(
            payments.filter((p) => p.createdByName === name).reduce((s, p) => s + Number(p.totalAmount ?? 0), 0),
          );
          money = metrics["amountCollected"];
          work = metrics["invoicesCreated"];
        }
        return { id: String(u._id), fullName: name, roleId: u.roleId, roleName: u.roleName, metrics, money, work };
      });

      return {
        from,
        to,
        rows,
        skipped: [
          "Appointments booked (receptionist): appointments do not record who booked them.",
          "Doctor revenue counts only invoices linked to a visit.",
        ],
      };
    }),
  );
