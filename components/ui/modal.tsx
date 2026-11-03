import { useEffect, useRef, type ReactNode } from "react";
import { useSettings } from "@/app/settings";

export function Modal({
  open,
  onClose,
  children,
  titleId,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  titleId: string;
}) {
  const { prefs } = useSettings();
  const t = (jp: string, kr: string) => (prefs.lang === "jp" ? jp : kr);
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open) {
      if (!element.open) element.showModal();
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
    if (element.open) element.close();
  }, [open]);
  return (
    <dialog
      ref={dialog}
      className="home-dialog"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const r = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < r.left ||
          event.clientX > r.right ||
          event.clientY < r.top ||
          event.clientY > r.bottom
        )
          onClose();
      }}
    >
      <div className="dialog-content">
        <button
          className="dialog-close"
          autoFocus
          aria-label={t("閉じる", "닫기")}
          onClick={() => onClose()}
        >
          ×
        </button>
        {children}
      </div>
    </dialog>
  );
}
