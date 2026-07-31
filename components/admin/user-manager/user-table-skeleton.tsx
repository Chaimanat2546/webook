import { Skeleton } from "../../ui/skeleton";

export const USER_TABLE_VIEWPORT_CLASS = "h-[34rem]";

export function UserTableSkeleton() {
  return (
    <div
      aria-label="กำลังโหลดรายชื่อผู้ดูแลระบบ"
      className="h-full"
      role="status"
    >
      <div aria-hidden className="space-y-2 p-1 md:hidden">
        {Array.from({ length: 10 }).map((_, index) => (
          <div className="space-y-3 rounded-lg border p-3" key={index}>
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-4 w-3/5" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <Skeleton className="h-3 w-4/5" />
          </div>
        ))}
      </div>
      <div aria-hidden className="hidden md:block">
        <div className="grid h-10 grid-cols-[34%_14%_18%_22%_12%] items-center border-b px-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton className="h-3 w-3/4" key={index} />
          ))}
        </div>
        {Array.from({ length: 10 }).map((_, rowIndex) => (
          <div
            className="grid h-12 grid-cols-[34%_14%_18%_22%_12%] items-center border-b px-2"
            key={rowIndex}
          >
            {Array.from({ length: 5 }).map((_, columnIndex) => (
              <Skeleton
                className={columnIndex === 4 ? "ml-auto h-8 w-14" : "h-4 w-3/4"}
                key={columnIndex}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
