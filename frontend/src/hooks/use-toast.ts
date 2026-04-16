import { useState, useCallback } from "react";
import type { ToastProps } from "@/components/ui/toast";

let toastIdCounter = 0;

export function useToast() {
  const [toasts, setToasts] = useState<ToastProps[]>([]);

  const toast = useCallback((props: Omit<ToastProps, "id">) => {
    const id = `toast-${++toastIdCounter}`;
    const newToast: ToastProps = { ...props, id };

    setToasts((prev) => [...prev, newToast]);

    // Auto remove after 3 seconds
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);

    return id;
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return {
    toast,
    removeToast,
    toasts,
  };
}
