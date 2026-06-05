import type { ReactNode } from "react";

interface DataTableColumn<T> {
  key: string;
  render: (record: T) => ReactNode;
}

interface DataTableProps<T extends { id?: number; date?: string; nav?: number }> {
  columns: DataTableColumn<T>[];
  records: T[];
  emptyText?: string;
  renderActions?: (record: T) => ReactNode;
  minRows?: number;
}

export function DataTable<T extends { id?: number; date?: string; nav?: number }>({
  columns,
  records,
  emptyText = "暂无记录",
  renderActions,
  minRows = 0,
}: DataTableProps<T>) {
  const colSpan = columns.length + (renderActions ? 1 : 0);
  const placeholderRows = Math.max(0, minRows - records.length);

  return (
    <tbody>
      {records.length === 0 ? (
        <>
          <tr>
            <td className="empty-row" colSpan={colSpan}>
              {emptyText}
            </td>
          </tr>
          {Array.from({ length: Math.max(0, placeholderRows - 1) }, (_, index) => (
            <tr className="placeholder-row" key={`placeholder-${index}`}>
              <td colSpan={colSpan}>&nbsp;</td>
            </tr>
          ))}
        </>
      ) : (
        <>
          {records.map((record) => (
            <tr key={record.id ?? `${record.date}-${record.nav}`}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(record)}</td>
              ))}
              {renderActions && (
                <td>
                  {renderActions(record)}
                </td>
              )}
            </tr>
          ))}
          {Array.from({ length: placeholderRows }, (_, index) => (
            <tr className="placeholder-row" key={`placeholder-${index}`}>
              <td colSpan={colSpan}>&nbsp;</td>
            </tr>
          ))}
        </>
      )}
    </tbody>
  );
}
