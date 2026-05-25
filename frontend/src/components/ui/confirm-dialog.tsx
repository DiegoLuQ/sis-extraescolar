"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type ConfirmOptions = {
  title?: string;
  description?: string | React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
};

type Resolver<T> = (value: T) => void;

let openConfirm: ((opts: ConfirmOptions) => Promise<boolean>) | null = null;
let openAlert: ((opts: ConfirmOptions) => Promise<void>) | null = null;

/**
 * confirmDialog — reemplazo de window.confirm con un modal accesible.
 * Uso: `if (!(await confirmDialog({ title: "..." }))) return;`
 *
 * Requiere que `<ConfirmDialogHost />` esté montado una vez en el layout.
 */
export function confirmDialog(opts: ConfirmOptions = {}): Promise<boolean> {
  if (!openConfirm) {
    if (typeof window !== "undefined") {
      // eslint-disable-next-line no-alert
      const fallbackText = typeof opts.description === "string" ? opts.description : (opts.title ?? "¿Confirmar?");
      return Promise.resolve(window.confirm(fallbackText));
    }
    return Promise.resolve(false);
  }
  return openConfirm(opts);
}

/**
 * alertDialog — modal informativo con un solo botón de aceptar.
 * Uso: `await alertDialog({ title: "...", description: "..." })`
 *
 * Requiere que `<ConfirmDialogHost />` esté montado una vez en el layout.
 */
export function alertDialog(opts: ConfirmOptions = {}): Promise<void> {
  if (!openAlert) {
    return Promise.resolve();
  }
  return openAlert(opts);
}

export function ConfirmDialogHost() {
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  const [mode, setMode] = React.useState<"confirm" | "alert">("confirm");
  const resolverRef = React.useRef<Resolver<boolean> | null>(null);
  const alertResolverRef = React.useRef<Resolver<void> | null>(null);

  React.useEffect(() => {
    openConfirm = (o) =>
      new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;
        setMode("confirm");
        setOpts(o);
      });
    openAlert = (o) =>
      new Promise<void>((resolve) => {
        alertResolverRef.current = resolve;
        setMode("alert");
        setOpts(o);
      });
    return () => {
      openConfirm = null;
      openAlert = null;
    };
  }, []);

  const close = (value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    alertResolverRef.current?.();
    alertResolverRef.current = null;
    setOpts(null);
  };

  const isOpen = opts !== null;

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && close(false)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{opts?.title ?? "¿Confirmar?"}</DialogTitle>
          {opts?.description && (
            typeof opts.description === "string" ? (
              <DialogDescription>{opts.description}</DialogDescription>
            ) : (
              <div className="text-sm text-muted-foreground">{opts.description}</div>
            )
          )}
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          {mode === "confirm" && (
            <Button variant="outline" onClick={() => close(false)}>
              {opts?.cancelText ?? "Cancelar"}
            </Button>
          )}
          <Button
            variant={opts?.destructive ? "destructive" : "default"}
            onClick={() => close(true)}
          >
            {mode === "alert" ? (opts?.confirmText ?? "Aceptar") : (opts?.confirmText ?? "Confirmar")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
