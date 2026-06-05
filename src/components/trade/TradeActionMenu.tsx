import { useEffect, useRef, useState } from "react";
import type { TradeRecord } from "../../types/fund";

interface TradeActionMenuProps {
  record: TradeRecord;
  onEdit: (record: TradeRecord) => void;
  onDelete: (record: TradeRecord) => void;
}

export function TradeActionMenu({ record, onEdit, onDelete }: TradeActionMenuProps) {
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
        </div>
      )}
    </div>
  );
}
