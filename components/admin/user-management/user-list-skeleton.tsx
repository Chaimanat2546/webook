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
            <CardHeader className="space-y-2">
              <Skeleton className="h-4 w-2/5" />
              <Skeleton className="h-3 w-3/5" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-7 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-hidden p-0 md:block">
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-[28%]">ชื่อ</TableHead>
              <TableHead className="w-[20%]">Username</TableHead>
              <TableHead className="w-[28%]">อีเมล</TableHead>
              <TableHead className="w-[14%]">สิทธิ์ผู้ใช้</TableHead>
              <TableHead className="w-[10%] text-right">การจัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {skeletonRows.map((_, index) => (
              <TableRow key={index}>
                <TableCell><Skeleton className="h-4 w-4/5" /></TableCell>
                <TableCell><Skeleton className="h-4 w-3/4" /></TableCell>
                <TableCell><Skeleton className="h-4 w-5/6" /></TableCell>
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
