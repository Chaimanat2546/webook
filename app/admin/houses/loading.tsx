import { Skeleton } from "../../../components/ui/skeleton";

export default function HousesLoading() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-44" />
      <Skeleton className="h-10 w-full max-w-sm" />
      {Array.from({ length: 8 }).map((_, index) => (
        <Skeleton className="h-24 rounded-lg" key={index} />
      ))}
    </div>
  );
}
