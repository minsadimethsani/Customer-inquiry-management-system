"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback(
    (toast: Omit<ToastMessage, "id"> & { id?: string }) => {
      const id =
        toast.id ||
        `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      setToasts((prev) => [...prev, { ...toast, id }]);
      return id;
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toastSuccess = useCallback(
    (title: string, message: string) => {
      return addToast({ type: "success", title, message });
    },
    [addToast]
  );

  const toastError = useCallback(
    (
      title: string,
      message: string,
      action?: { label: string; onClick: () => void }
    ) => {
      return addToast({ type: "error", title, message, action });
    },
    [addToast]
  );

  const toastWarning = useCallback(
    (title: string, message: string) => {
      return addToast({ type: "warning", title, message });
    },
    [addToast]
  );

  const toastInfo = useCallback(
    (title: string, message: string) => {
      return addToast({ type: "info", title, message });
    },
    [addToast]
  );

  return {
    toasts,
    addToast,
    removeToast,
    toastSuccess,
    toastError,
    toastWarning,
    toastInfo,
  };
}

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => onDismiss(toast.id)} />
      ))}
    </div>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 5000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const getTheme = () => {
    switch (toast.type) {
      case "success":
        return {
          bg: "bg-emerald-50 border-emerald-300 text-emerald-950",
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />,
          titleColor: "text-emerald-900",
        };
      case "error":
        return {
          bg: "bg-rose-50 border-rose-300 text-rose-950",
          icon: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
          titleColor: "text-rose-900",
        };
      case "warning":
        return {
          bg: "bg-amber-50 border-amber-300 text-amber-950",
          icon: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
          titleColor: "text-amber-900",
        };
      default:
        return {
          bg: "bg-blue-50 border-blue-300 text-blue-950",
          icon: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
          titleColor: "text-blue-900",
        };
    }
  };

  const theme = getTheme();

  return (
    <div
      role="alert"
      className={`pointer-events-auto p-4 rounded-xl border shadow-lg backdrop-blur-md flex items-start gap-3 transition-all animate-in slide-in-from-bottom-3 duration-200 ${theme.bg}`}
    >
      <div className="mt-0.5">{theme.icon}</div>
      <div className="flex-1 min-w-0">
        <h4 className={`text-xs font-bold leading-none mb-1 ${theme.titleColor}`}>
          {toast.title}
        </h4>
        <p className="text-xs leading-relaxed opacity-90 break-words">
          {toast.message}
        </p>
        {toast.action && (
          <button
            type="button"
            onClick={toast.action.onClick}
            className="mt-2 text-xs font-bold underline hover:opacity-80 cursor-pointer"
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="p-1 text-slate-400 hover:text-slate-700 rounded-md transition-colors"
        title="Dismiss alert"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
