/**
 * Starts the 15-day free trial for a clinic the first time an admin registers under a new clinic name.
 * "New" = no other staff account already uses that clinicName, so existing clinics never get a trial.
 * Idempotent: the unique clinicKey means a second call (or a race) cannot create or reset a trial.
 */
import { ClinicTrial } from "@/lib/mongodb/models/ClinicTrial";
import { User } from "@/lib/mongodb/models/User";
import { TRIAL_DAYS, addDaysYmd, istToday } from "@/lib/trial/trialSchedule";

export async function startTrialIfNewClinic(admin: { _id: unknown; fullName: string; email: string; clinicName: string }): Promise<boolean> {
  const clinicName = admin.clinicName.trim();
  const clinicKey = clinicName.toLowerCase();
  const exact = new RegExp(`^${clinicName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
  if (await User.exists({ clinicName: exact, _id: { $ne: admin._id as never } })) return false;
  const startDate = istToday();
  try {
    await ClinicTrial.create({
      clinicKey,
      clinicName,
      ownerUserId: String(admin._id),
      ownerName: admin.fullName,
      ownerEmail: admin.email,
      startDate,
      endDate: addDaysYmd(startDate, TRIAL_DAYS),
      status: "trial",
    });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return false; // already has a trial
    throw e;
  }
}
