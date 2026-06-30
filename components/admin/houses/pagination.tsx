import {
  Pagination as ShadcnPagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "../../ui/pagination";
import { getPaginationItems } from "../../../server/services/houses";
import { cn } from "../../../lib/utils";

export function Pagination({
  basePath = "/admin/houses",
  currentPage,
  search,
  totalPages,
}: {
  basePath?: string;
  currentPage: number;
  search: string;
  totalPages: number;
}) {
  if (totalPages <= 1) {
    return null;
  }

  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const items = getPaginationItems(safeCurrentPage, totalPages);
  const getHref = (page: number) => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (search) params.set("q", search);
    return `${basePath}?${params}`;
  };

  return (
    <ShadcnPagination className="mt-4">
      <PaginationContent className="flex-wrap">
        <PaginationItem>
          <PaginationPrevious
            aria-disabled={safeCurrentPage === 1}
            className={cn(safeCurrentPage === 1 && "pointer-events-none opacity-50")}
            href={getHref(Math.max(1, safeCurrentPage - 1))}
            tabIndex={safeCurrentPage === 1 ? -1 : undefined}
            text="ก่อนหน้า"
          />
        </PaginationItem>
        {items.map((item, index) => (
          <PaginationItem key={`${item}-${index}`}>
            {item === "ellipsis" ? (
              <PaginationEllipsis />
            ) : (
              <PaginationLink href={getHref(item)} isActive={item === safeCurrentPage}>
                {item}
              </PaginationLink>
            )}
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            aria-disabled={safeCurrentPage === totalPages}
            className={cn(safeCurrentPage === totalPages && "pointer-events-none opacity-50")}
            href={getHref(Math.min(totalPages, safeCurrentPage + 1))}
            tabIndex={safeCurrentPage === totalPages ? -1 : undefined}
            text="ถัดไป"
          />
        </PaginationItem>
      </PaginationContent>
    </ShadcnPagination>
  );
}
