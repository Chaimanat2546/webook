import { Skeleton } from "../../../../../components/ui/skeleton";

export default function ImagesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Skeleton className="h-48 rounded-lg" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton className="h-64 rounded-lg" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
