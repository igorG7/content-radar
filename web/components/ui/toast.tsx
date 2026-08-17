"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { IconAlert, IconCheck } from "./icons";

export interface ToastOptions {
  tone?: "ok" | "danger";
  title: string;
  detail?: string;
  /** Presente → o toast ganha um botão Desfazer e vive mais tempo. */
  undo?: () => void;
  duration?: number;
}

interface ToastItem extends ToastOptions {
  id: number;
}

const ToastContext = createContext<((opts: ToastOptions) => void) | null>(null);

export function useToast() {
  const toast = useContext(ToastContext);
  if (!toast) throw new Error("useToast precisa de um <ToastProvider> acima");
  return toast;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = nextId.current++;
      setItems((current) => [...current, { ...opts, id }]);
      const duration = opts.duration ?? (opts.undo ? 9000 : 5000);
      if (duration !== 0) setTimeout(() => dismiss(id), duration);
    },
    [dismiss],
  );

  const value = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-stack" role="status" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast-${item.tone ?? "ok"}`}>
            <span className="toast-mark">
              {item.tone === "danger" ? <IconAlert /> : <IconCheck />}
            </span>
            <div className="toast-body">
              <strong>{item.title}</strong>
              {item.detail && <p>{item.detail}</p>}
              {item.undo && (
                <button
                  className="toast-undo"
                  type="button"
                  onClick={() => {
                    item.undo?.();
                    dismiss(item.id);
                  }}
                >
                  Desfazer
                </button>
              )}
            </div>
            <button
              className="toast-close"
              type="button"
              aria-label="Fechar aviso"
              onClick={() => dismiss(item.id)}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
