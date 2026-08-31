import { Card, CardContent, CardHeader } from "../../ui/card";
import { Skeleton } from "../../ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/table";

const skeletonRows = Array.from({ length: 8 });

export function UserListSkeleton() {
  return (
    <div aria-label="กำลังโหลดรายชื่อผู้ใช้" aria-live="polite" className="space-y-4" role="status">
      <div className="grid gap-3 md:hidden">
        {skeletonRows.map((_, index) => (
          <Card key={index}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="min-w-0 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-40" />
              </div>
              <Skeleton className="h-5 w-16 rounded-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              <dl className="grid gap-3 text-sm">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-10" />
                  <Skeleton className="h-4 w-16" />
                </div>
                <div className="space-y-2">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </dl>
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden p-0 md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[20%]">ชื่อ</TableHead>
              <TableHead className="w-[15%]">Username</TableHead>
              <TableHead className="w-[22%]">อีเมล</TableHead>
              <TableHead className="w-[13%]">DV ID</TableHead>
              <TableHead className="w-[18%]">สิทธิ์ผู้ใช้</TableHead>
              <TableHead className="w-[12%] text-right">การจัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skeletonRows.map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-4 w-4/5" /></TableCell>
                <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-5/6" /></TableCell>
                <TableCell><Skeleton className="h-4 w-2/3" /></TableCell>
                <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
                <TableCell><Skeleton className="ml-auto h-7 w-16" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>

      <Skeleton className="mx-auto h-8 w-56" />
    </div>
  );
}
