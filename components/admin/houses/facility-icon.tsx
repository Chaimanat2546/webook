import {
  BathIcon,
  BedDoubleIcon,
  CircleDotDashedIcon,
  Disc3Icon,
  LifeBuoyIcon,
  MicVocalIcon,
  PawPrintIcon,
  WavesIcon,
  WavesLadderIcon,
  WifiIcon,
} from "lucide-react";
import { FaHotTubPerson, FaTableTennisPaddleBall } from "react-icons/fa6";
import { GiBarbecue, GiHockey, GiKidSlide, GiPoolTriangle } from "react-icons/gi";
import type { ComponentType } from "react";

import {
  getListingFacilityIconKey,
  type ListingFacilityIconKey,
} from "../../../lib/listing-facilities";

const facilityIconByKey = {
  Wifi: WifiIcon,
  Barbecue: GiBarbecue,
  PawPrint: PawPrintIcon,
  CircleDotDashed: CircleDotDashedIcon,
  Disc3: Disc3Icon,
  LifeBuoy: LifeBuoyIcon,
  TableTennis: FaTableTennisPaddleBall,
  KidSlide: GiKidSlide,
  PoolTriangle: GiPoolTriangle,
  Waves: WavesIcon,
  MicVocal: MicVocalIcon,
  Hockey: GiHockey,
  HotTub: FaHotTubPerson,
  Bath: BathIcon,
  WavesLadder: WavesLadderIcon,
  BedDouble: BedDoubleIcon,
} satisfies Record<ListingFacilityIconKey, ComponentType<{ "aria-hidden"?: boolean; className?: string }>>;

export function FacilityIcon({
  facility,
}: {
  facility: { name: string | null; title: string | null };
}) {
  const iconKey = getListingFacilityIconKey(facility);
  if (!iconKey) return null;

  const Icon = facilityIconByKey[iconKey];
  return <Icon aria-hidden className="size-5 shrink-0 text-muted-foreground" />;
}
