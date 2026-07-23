import { useEffect, useRef, useState } from "react";
interface ActionRecord {
  id: number;
}

interface TradeActionMenuProps<T extends ActionRecord> {
  record: T;
  onEdit: (record: T) => void;
  onDelete?: (record: T) => void;
}

export function TradeActionMenu<T extends ActionRecord>({ record, onEdit, onDelete }: TradeActionMenuProps<T>) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return undefined;

    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="row-menu" ref={menuRef}>
      <button
        className="row-menu-button"
        type="button"
        aria-label="交易操作"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        ⋯
      </button>
      {open && (
        <div className="row-menu-panel" role="menu">
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onEdit(record);
            }}
          >
            编辑
          </button>
          {onDelete && (
            <button
              className="danger"
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                onDelete(record);
              }}
            >
              删除
            </button>
          )}
        </div>
      )}
    </div>
  );
}
