import { Card, CardContent, CardHeader } from "../../../components/ui/card";
import { Skeleton } from "../../../components/ui/skeleton";
import {
  USER_TABLE_VIEWPORT_CLASS,
  UserTableSkeleton,
} from "../../../components/admin/user-manager/user-table-skeleton";

export default function UserManagerLoading() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-7 w-56" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-9 w-full sm:w-28" />
      </div>
      <div className="grid min-w-0 gap-4 xl:grid-cols-[16rem_minmax(0,1fr)_18rem]">
        <Card>
          <CardHeader><Skeleton className="h-5 w-28" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-9 w-full" />
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton className="h-20 w-full" key={index} />
            ))}
          </CardContent>
        </Card>
        <Card className="min-w-0 overflow-hidden">
          <CardHeader><Skeleton className="h-5 w-28" /></CardHeader>
          <CardContent className="space-y-4">
            <div
              className={`${USER_TABLE_VIEWPORT_CLASS} overflow-x-auto overflow-y-auto overscroll-contain`}
            >
              <UserTableSkeleton />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-3 w-10" />
              <Skeleton className="h-8 w-20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-40" /></CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-9 w-full" />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
