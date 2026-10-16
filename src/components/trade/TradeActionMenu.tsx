import { useRef, useState } from "react";
import { ViewportMenu } from "../ViewportMenu";
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
        <ViewportMenu className="row-menu-panel" anchorRef={menuRef} onClose={() => setOpen(false)}>
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
        </ViewportMenu>
      )}
    </div>
  );
}
