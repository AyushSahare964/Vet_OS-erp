import { createFileRoute } from "@tanstack/react-router";

/**
 * Hourly cron target (see vercel.json): appointment reminders + free-trial reminders. ?only=appointments|trial limits it. Vercel sends `Authorization: Bearer $CRON_SECRET`; the same header works for manual/dev runs:
 *   curl -H "Authorization: Bearer <CRON_SECRET>" "http://localhost:8080/api/cron/appointment-reminders?dryRun=1"
 */
export const Route = createFileRoute("/api/cron/appointment-reminders")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const secret = process.env["CRON_SECRET"];
        if (!secret) return Response.json({ error: "CRON_SECRET is not configured" }, { status: 503 });
        if (request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
        const { runAppointmentReminders } = await import("@/lib/reminders/appointmentReminderJob");
        const { runTrialReminders, trialTestRecipient } = await import("@/lib/trial/clinicTrialJob");
        const q = new URL(request.url).searchParams;
        const dryRun = q.get("dryRun") === "1";
        // `now` simulates a date for the trial job (test fixtures only), and only while test mode is on.
        const simulated = Date.parse(q.get("now") || "");
        const now = trialTestRecipient() && !Number.isNaN(simulated) ? simulated : undefined;
        const only = q.get("only");
        return Response.json({
          ...(only !== "trial" && { appointments: await runAppointmentReminders({ dryRun }) }),
          ...(only !== "appointments" && { trials: await runTrialReminders({ dryRun, ...(now !== undefined && { now }) }) }),
        });
      },
    },
  },
});
