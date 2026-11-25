// Admin tablo deseni: sticky başlık, 52 px satır, zebra yok,
// hover surface-2, yükleniyorken 8 satır skeleton, boşken EmptyState. Sıralama/sayfalama çağıranda.
import { Skeleton } from '@/components/ui/skeleton.jsx';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.jsx';
import { cn } from '@/lib/utils';

/**
 * @template T
 * @param {{
 *   columns: { key: string, header: import('react').ReactNode, cell: (row: T) => import('react').ReactNode,
 *     className?: string, srOnlyHeader?: boolean }[],
 *   rows: T[] | undefined,
 *   getRowId: (row: T) => string|number,
 *   caption: string,
 *   isLoading?: boolean,
 *   empty?: import('react').ReactNode,
 *   className?: string,
 * }} props
 */
export function DataTable({ columns, rows, getRowId, caption, isLoading, empty, className }) {
  if (!isLoading && rows?.length === 0 && empty) return empty;
  return (
    <div className={cn('bg-card overflow-hidden rounded-[var(--radius-lg)] border', className)}>
      <Table>
        <caption className="sr-only">{caption}</caption>
        <TableHeader className="bg-surface-2/80 sticky top-0 z-[1] backdrop-blur">
          <TableRow className="hover:bg-transparent">
            {columns.map((col) => (
              <TableHead key={col.key} className={col.className}>
                {col.srOnlyHeader ? <span className="sr-only">{col.header}</span> : col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading
            ? Array.from({ length: 8 }, (_, i) => (
                <TableRow key={i} className="h-[52px]">
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      <Skeleton className="h-4 w-full max-w-40" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : rows?.map((row) => (
                <TableRow key={getRowId(row)} className="hover:bg-surface-2 h-[52px]">
                  {columns.map((col) => (
                    <TableCell key={col.key} className={col.className}>
                      {col.cell(row)}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
    </div>
  );
}
