import { createFileRoute } from "@tanstack/react-router";
import { useErp } from "@/lib/erp/store";
import { ClinicDashboard } from "@/components/clinic/ClinicDashboard";
import { DOCTOR_HOME_ROLES, doctorHeadLinks } from "@/components/doctor/doctorHead";
import { DoctorLayout } from "@/components/doctor/layout/DoctorLayout";
import { HomeDashboard } from "@/components/doctor/home/HomeDashboard";
import LandingPage from "@/components/landing/LandingPage";
import { landingHeadLinks } from "@/components/landing/landingHead";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "VetechIQ — Veterinary Clinic Management Suite" },
      {
        name: "description",
        content:
          "VetechIQ clinical operations: appointments, OPD consultation, live inventory Rx, billing, accounting and HRMS in one console.",
      },
      { property: "og:title", content: "VetechIQ — Veterinary Clinic Management Suite" },
      {
        property: "og:description",
        content:
          "Doctor-tailored clinic ERP with live OPD queue, multi-pet CRM, dynamic inventory billing, and double-entry accounting.",
      },
    ],
    links: [...doctorHeadLinks, ...landingHeadLinks],
  }),
  component: Home,
});

// Doctor, admin and platform users get the new doctor home (blue design).
// Other roles keep the previous dashboard, which also lives at /clinic.
// Signed-out visitors get the marketing landing page; signed-in users get their dashboard.
function Home() {
  const { isAuthenticated, isLoadingAuth } = useErp();
  if (isLoadingAuth) return <SessionLoader />;
  if (!isAuthenticated) return <LandingPage />;
  return <HomeForRole />;
}

function SessionLoader() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center">
      <div className="size-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function HomeForRole() {
  const { roleId } = useErp();
  if (!DOCTOR_HOME_ROLES.has(roleId)) return <ClinicDashboard title="Home Dashboard" />;
  return (
    <DoctorLayout showSearch>
      <HomeDashboard />
    </DoctorLayout>
  );
}
