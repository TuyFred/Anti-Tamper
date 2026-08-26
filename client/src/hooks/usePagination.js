import { useEffect, useMemo, useState } from 'react';

export const LIST_PAGE_SIZE = 10;
export const DASHBOARD_PAGE_SIZE = 10;

export function usePagination(items, pageSize = LIST_PAGE_SIZE) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    setPage(1);
  }, [total, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const slice = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  return {
    page,
    setPage,
    totalPages,
    pageSize,
    slice,
    total,
    rangeStart,
    rangeEnd,
    hasPrev: page > 1,
    hasNext: page < totalPages,
  };
}
