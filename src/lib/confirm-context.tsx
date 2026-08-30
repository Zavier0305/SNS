"use client";

import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

type ConfirmOptions = {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

type ConfirmFn = (options: ConfirmOptions | string) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    const opts = typeof options === "string" ? { message: options } : options;
    setState(opts);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function resolve(result: boolean) {
    setState(null);
    resolverRef.current?.(result);
    resolverRef.current = null;
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          onClick={() => resolve(false)}
          role="alertdialog"
          aria-modal="true"
          aria-label={state.message}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-xl bg-background border border-black/10 dark:border-white/10 p-4 shadow-lg"
          >
            <p className="text-sm whitespace-pre-wrap">{state.message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                onClick={() => resolve(false)}
                className="text-sm px-3 py-1.5 rounded-full text-black/60 dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/10"
              >
                {state.cancelLabel ?? "キャンセル"}
              </button>
              <button
                onClick={() => resolve(true)}
                autoFocus
                className={`text-sm px-3 py-1.5 rounded-full font-medium hover:opacity-90 ${
                  state.danger ? "bg-red-500 text-white" : "bg-foreground text-background"
                }`}
              >
                {state.confirmLabel ?? "OK"}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
