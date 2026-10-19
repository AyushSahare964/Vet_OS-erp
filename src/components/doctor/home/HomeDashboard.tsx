import { ClinicIdentity } from "./ClinicIdentity";
import { PetsStage } from "./PetsStage";
import { WelcomeBanner } from "@/components/erp/dashboards/WelcomeBanner";
import "./home-final.css";

/** Centre of the doctor home: clinic identity, then kitten + board at the bottom. */
export function HomeDashboard() {
  return (
    <div className="home vd-home" id="home">
      <WelcomeBanner className="vd-home-welcome mt-4 w-full max-w-[860px] self-center" />
      <ClinicIdentity />
      <PetsStage />
    </div>
  );
}
