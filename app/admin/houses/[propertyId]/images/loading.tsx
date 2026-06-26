import { Skeleton } from "../../../../../components/ui/skeleton";

export default function ImagesLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-10 w-72" />
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <Skeleton className="h-48 rounded-lg" />
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9rem,9rem))] items-start justify-start gap-2 p-2 sm:grid-cols-[repeat(auto-fill,minmax(10rem,10rem))]">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton className="h-40 rounded-lg sm:h-44" key={index} />
          ))}
        </div>
      </div>
    </div>
  );
}
