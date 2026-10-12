import { useState } from "react";
import { 
  Heart, 
  ShieldCheck, 
  Activity,
  PawPrint,
  Sparkles,
  Stethoscope
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PetCardData {
  id: string;
  name: string;
  species: string;
  breed: string;
  image: string;
  status: string;
  statusColor: string;
  vitals: string;
  tag: string;
}

const PET_LIST: PetCardData[] = [
  {
    id: "pet-1",
    name: "Buddy",
    species: "Golden Retriever",
    breed: "Post-Op Recovery · 3.5 yrs",
    image: "/pets/golden.jpg",
    status: "Healthy & Active",
    statusColor: "text-emerald-700 bg-emerald-50 border-emerald-200/80",
    vitals: "86 BPM · Normal",
    tag: "Surgery",
  },
  {
    id: "pet-2",
    name: "Luna",
    species: "Siamese Kitten",
    breed: "FVRCP Booster · 1.5 yrs",
    image: "/pets/cat.jpg",
    status: "Vaccinated",
    statusColor: "text-blue-700 bg-blue-50 border-blue-200/80",
    vitals: "120 BPM · Clear",
    tag: "Wellness",
  },
  {
    id: "pet-3",
    name: "Milo",
    species: "French Bulldog",
    breed: "Dental Prophylaxis · 2 yrs",
    image: "/pets/bulldog.jpg",
    status: "Clean Vitals",
    statusColor: "text-emerald-700 bg-emerald-50 border-emerald-200/80",
    vitals: "92 BPM · SpO₂ 99%",
    tag: "Dental",
  },
  {
    id: "pet-4",
    name: "Bella",
    species: "Holland Lop",
    breed: "Luxury Boarding Suite #4 · 1 yr",
    image: "/pets/bunny.jpg",
    status: "Happy Guest",
    statusColor: "text-purple-700 bg-purple-50 border-purple-200/80",
    vitals: "175 BPM · Playtime",
    tag: "Boarding",
  },
];

import { BrandChip } from "@/components/doctor/shared/BrandChip";

export function PetShowcase() {
  return (
    <div 
      className="relative flex h-full w-full flex-col justify-between overflow-hidden p-6 lg:p-8"
      style={{
        backgroundColor: "#eaf3fa",
        backgroundImage: `radial-gradient(circle at 10% 20%, rgba(123, 189, 232, 0.25) 0%, transparent 50%), radial-gradient(circle at 90% 80%, rgba(10, 65, 116, 0.12) 0%, transparent 50%), url("/pattern/pets-pattern.svg")`,
        backgroundSize: "cover, cover, 260px 260px",
      }}
    >
      {/* Soft Ambient Background Highlights */}
      <div className="pointer-events-none absolute -left-16 -top-16 size-48 rounded-full bg-[#7bbde8]/25 blur-2xl" />
      <div className="pointer-events-none absolute -right-16 -bottom-16 size-48 rounded-full bg-[#0a4174]/15 blur-2xl" />

      {/* Header section */}
      <div className="relative z-10 space-y-2">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-[#bcd0e2] bg-white/95 px-3 py-1 text-[0.7rem] font-bold text-[#0a4174] shadow-2xs">
          <span className="relative flex size-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          <span>Live Clinical Monitoring</span>
        </div>

        <h2 className="text-xl font-extrabold tracking-tight text-[#001d39] lg:text-2xl font-['Bricolage_Grotesque',system-ui,sans-serif]">
          Compassionate Care, <br />
          <span className="text-[#0a4174]">Powered by</span>{" "}
          <BrandChip />
        </h2>
      </div>

      {/* CONTINUOUS ANIMATED PET SLIDER (Light Theme) */}
      <div className="marquee-pause relative my-4 h-[300px] w-full overflow-hidden [mask-image:linear-gradient(to_bottom,transparent,black_8%,black_92%,transparent)]">
        <div className="space-y-3 animate-marquee-vertical hover:[animation-play-state:paused]">
          {[...PET_LIST, ...PET_LIST].map((pet, idx) => (
            <div
              key={`${pet.id}-${idx}`}
              className={cn(
                "group flex items-center gap-3 rounded-2xl border border-[#d3e2ef] bg-white/95 p-3 shadow-xs transition-all duration-300",
                "hover:scale-[1.01] hover:border-[#7bbde8] hover:shadow-[0_8px_20px_rgba(10,65,116,0.12)] hover:bg-white"
              )}
            >
              {/* Pet 3D Image */}
              <div className="relative size-14 shrink-0 overflow-hidden rounded-xl border border-[#d3e2ef] bg-[#eaf3fa] shadow-2xs">
                <img
                  src={pet.image}
                  alt={pet.name}
                  className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="absolute bottom-0.5 right-0.5 flex size-4 items-center justify-center rounded-full bg-white text-rose-500 shadow-2xs border border-[#d3e2ef]">
                  <Heart className="size-2.5 fill-rose-500 text-rose-500 animate-heartbeat" />
                </span>
              </div>

              {/* Pet Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-sm font-bold text-[#001d39] group-hover:text-[#0a4174] transition-colors truncate">
                    {pet.name}
                  </span>
                  <span className="shrink-0 rounded-md bg-[#eaf3fa] border border-[#bcd0e2] px-2 py-0.5 text-[0.62rem] font-bold text-[#0a4174]">
                    {pet.tag}
                  </span>
                </div>

                <p className="text-[0.72rem] text-[#4d6a86] truncate">{pet.species} · {pet.breed}</p>

                <div className="mt-1 flex items-center justify-between text-[0.65rem]">
                  <span className="flex items-center gap-1 font-bold text-[#2f9e6b]">
                    <Activity className="size-2.5" />
                    {pet.status}
                  </span>
                  <span className="text-[#4d6a86] font-medium">{pet.vitals}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Minimal Footer Metrics */}
      <div className="relative z-10 flex items-center justify-between border-t border-[#d3e2ef] pt-3 text-[0.72rem] text-[#4d6a86]">
        <div className="flex items-center gap-1.5 font-semibold">
          <PawPrint className="size-3.5 text-[#0a4174]" />
          <span><strong className="text-[#001d39]">1,420+</strong> Pets Monitored</span>
        </div>
        <div className="flex items-center gap-1.5 font-semibold text-[#2f9e6b]">
          <ShieldCheck className="size-3.5" />
          <span>99.9% Uptime</span>
        </div>
      </div>
    </div>
  );
}
