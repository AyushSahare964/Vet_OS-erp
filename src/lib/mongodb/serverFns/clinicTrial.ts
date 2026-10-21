/** Platform-admin control of a clinic's trial/subscription status. Marking "paid" or "cancelled" stops all trial reminders. */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { connectDB } from "@/lib/mongodb/client";
import { ClinicTrial } from "@/lib/mongodb/models/ClinicTrial";
import { getMeFn } from "./auth";

export const setClinicTrialStatusFn = createServerFn({ method: "POST" })
  .validator((raw: unknown) => z.object({ clinicName: z.string().min(1), status: z.enum(["trial", "expired", "paid", "cancelled"]) }).parse(raw))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const me = await getMeFn();
    if (!me || me.roleId !== "platform") throw new Error("Not permitted");
    await connectDB();
    const r = await ClinicTrial.updateOne({ clinicKey: data.clinicName.trim().toLowerCase() }, { $set: { status: data.status } });
    if (r.matchedCount !== 1) throw new Error("No trial found for that clinic");
    return { ok: true };
  });
