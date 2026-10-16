import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";

interface ViewportMenuProps {
  anchorRef: RefObject<HTMLElement | null>;
  className: string;
  children: ReactNode;
  onClose: () => void;
}

// Tables scroll independently; keep their menus outside the clipping container.
export function ViewportMenu({ anchorRef, className, children, onClose }: ViewportMenuProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const rect = anchor.getBoundingClientRect();
      const scrollArea = anchor.closest(".table-wrap")?.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= innerHeight || rect.right <= 0 || rect.left >= innerWidth
        || (scrollArea && (rect.bottom <= scrollArea.top || rect.top >= scrollArea.bottom))) {
        onClose();
        return;
      }
      const padding = 12;
      const width = panel.offsetWidth;
      const height = panel.offsetHeight;
      const below = innerHeight - rect.bottom;
      const above = rect.top;
      const left = Math.max(padding, Math.min(rect.right - width, innerWidth - width - padding));
      const top = Math.max(padding, Math.min(
        below >= height + padding || below >= above ? rect.bottom + 6 : rect.top - height - 6,
        innerHeight - height - padding,
      ));
      setPosition((current) => current?.left === left && current?.top === top ? current : { left, top });
    };
    update();
    const observer = new ResizeObserver(update);
    if (panelRef.current) observer.observe(panelRef.current);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchorRef, onClose]);

  const positioned = position !== null;
  useEffect(() => {
    if (positioned) panelRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
  }, [positioned]);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node) && !panelRef.current?.contains(event.target as Node)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        anchorRef.current?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
        onClose();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [anchorRef, onClose]);

  return createPortal(
    <div ref={panelRef} className={`${className} viewport-menu`} role="menu" style={{
      left: position?.left ?? 0,
      top: position?.top ?? 0,
      visibility: position ? "visible" : "hidden",
    }}>
      {children}
    </div>,
    document.body,
  );
}
