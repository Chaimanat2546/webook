"use client";

import type { ImageZoneGroup } from "../../../server/services/images";

interface CoverSelectViewerProps {
  groups: ImageZoneGroup[];
  propertyId: string;
  returnTo?: string;
  saveAction: (imageIds: number[]) => Promise<{ savedCount: number }>;
  selectedZone?: string;
}

export function CoverSelectViewer({
  groups,
  propertyId,
  returnTo,
  saveAction,
  selectedZone,
}: CoverSelectViewerProps) {
  void groups;
  void propertyId;
  void returnTo;
  void saveAction;
  void selectedZone;

  return <div>Cover select</div>;
}
