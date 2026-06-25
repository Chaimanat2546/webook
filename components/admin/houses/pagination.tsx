import {
  Pagination as ShadcnPagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
} from "../../ui/pagination";

export function Pagination({
  currentPage,
  search,
  totalPages,
}: {
  currentPage: number;
  search: string;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const pages = Array.from({ length: totalPages }, (_, index) => index + 1);

  return (
    <ShadcnPagination className="mt-4">
      <PaginationContent className="flex-wrap">
        {pages.map((page) => {
          const params = new URLSearchParams();
          params.set("page", String(page));
          if (search) params.set("q", search);

          return (
            <PaginationItem key={page}>
              <PaginationLink href={`/admin/houses?${params}`} isActive={page === currentPage}>
                {page}
              </PaginationLink>
            </PaginationItem>
          );
        })}
      </PaginationContent>
    </ShadcnPagination>
  );
}
