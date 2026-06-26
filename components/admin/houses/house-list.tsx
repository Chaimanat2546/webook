import Link from "next/link";

import type { HouseListItem } from "../../../server/services/houses";
import { Badge } from "../../ui/badge";
import { Button } from "../../ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";

function StatusBadge({ active }: { active: boolean | null }) {
  return <Badge variant={active ? "default" : "secondary"}>{active ? "Active" : "Inactive"}</Badge>;
}

function imageHref(propertyId: string, returnTo: string) {
  const params = new URLSearchParams();
  params.set("returnTo", returnTo);
  return `/admin/houses/${encodeURIComponent(propertyId)}/images?${params}`;
}

export function HouseList({ houses, returnTo }: { houses: HouseListItem[]; returnTo: string }) {
  return (
    <>
      <div className="flex flex-col gap-3 md:hidden">
        {houses.map((house) => (
          <Card className={house.is_active ? "" : "opacity-70"} key={house.property_id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-sm">{house.title || "-"}</CardTitle>
                <p className="font-mono text-xs text-muted-foreground">{house.property_id}</p>
              </div>
              <StatusBadge active={house.is_active} />
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <dl className="grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                <div>
                  <dt>ห้องนอน</dt>
                  <dd className="font-medium text-foreground">{house.bedrooms ?? "-"}</dd>
                </div>
                <div>
                  <dt>ห้องน้ำ</dt>
                  <dd className="font-medium text-foreground">{house.bathrooms ?? "-"}</dd>
                </div>
                <div>
                  <dt>โซน</dt>
                  <dd className="font-medium text-foreground">{house.location_zone || "-"}</dd>
                </div>
              </dl>
              <Button asChild className="w-full">
                <Link href={imageHref(house.property_id, returnTo)}>จัดการรูป</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden p-0 md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อบ้านพัก</TableHead>
              <TableHead>ID</TableHead>
              <TableHead>ห้องนอน</TableHead>
              <TableHead>ห้องน้ำ</TableHead>
              <TableHead>ทำเล(zone)</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-right">การจัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {houses.map((house) => (
              <TableRow className={house.is_active ? "" : "opacity-70"} key={house.property_id}>
                <TableCell className="font-medium">{house.title || "-"}</TableCell>
                <TableCell className="font-mono text-xs">DV-{house.property_id}</TableCell>
                <TableCell className="text-muted-foreground">{house.bedrooms ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground">{house.bathrooms ?? "-"}</TableCell>
                <TableCell className="text-muted-foreground">{house.location_zone || "-"}</TableCell>
                <TableCell>
                  <StatusBadge active={house.is_active} />
                </TableCell>
                <TableCell className="text-right">
                  <Button asChild size="sm" variant="outline">
                    <Link href={imageHref(house.property_id, returnTo)}>จัดการรูป</Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </>
  );
}
