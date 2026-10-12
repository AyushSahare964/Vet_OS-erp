import type { ReactNode } from "react";
import { BrandChip } from "../shared/BrandChip";
import type { DoctorHomeStats } from "@/lib/mongodb/serverFns/search";

/** Running-screen messages generated dynamically from real live tenant metrics. */
export const buildTenantRunningMessages = (
  stats: DoctorHomeStats | null,
  clinicName: string
): ReactNode[] => {
  if (!stats || (stats.totalPatients === 0 && stats.totalVisits === 0)) {
    return [
      <>
        Welcome to <em>{clinicName}</em> on <BrandChip />
      </>,
      <>
        <BrandChip /> database is active and ready for patient consultations
      </>,
      <>
        OPD consultations, live inventory Rx and billing in <em>one unified console</em>
      </>,
      <>
        Press <em>&quot;/&quot;</em> anywhere to search patients, records and medicines
      </>,
      <>
        Multi-tenant database isolation verified for <em>{clinicName}</em>
      </>,
    ];
  }

  const msgs: ReactNode[] = [
    <>
      <BrandChip /> manages <em>{stats.totalPatients} registered pets</em> for {clinicName}
    </>,
    <>
      <BrandChip /> has recorded <em>{stats.totalVisits} consultations &amp; visits</em>
    </>,
    <>
      <BrandChip /> connects <em>{stats.totalClients} pet parents</em> to your practice
    </>,
  ];

  if (stats.totalVaccinations > 0) {
    msgs.push(
      <>
        <BrandChip /> tracks <em>{stats.totalVaccinations} vaccinations &amp; preventive doses</em>
      </>
    );
  } else {
    msgs.push(
      <>
        Press <em>&quot;/&quot;</em> to instantly lookup any patient, bill or medicine
      </>
    );
  }

  msgs.push(
    <>
      Fast, paperless OPD records tailored for <em>{clinicName}</em>
    </>
  );

  return msgs;
};
