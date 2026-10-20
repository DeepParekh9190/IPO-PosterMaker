"use client";

import {
  useEffect,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

/* ------------------------------------------------------------------ Button */
type ButtonVariant = "primary" | "accent" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-slate-900 text-white hover:bg-slate-800 focus-visible:ring-slate-900",
  accent: "bg-emerald-600 text-white hover:bg-emerald-500 focus-visible:ring-emerald-600",
  secondary:
    "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-slate-400",
  danger:
    "border border-red-300 bg-white text-red-700 hover:bg-red-50 focus-visible:ring-red-500",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-400",
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-55",
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

/* ------------------------------------------------------------------ Badge */
const BADGE_TONES = {
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-800",
  red: "border-red-200 bg-red-50 text-red-800",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  blue: "border-sky-200 bg-sky-50 text-sky-800",
} as const;

export function Badge({
  tone = "slate",
  className,
  children,
}: {
  tone?: keyof typeof BADGE_TONES;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/* ------------------------------------------------------------------- Card */
export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white shadow-sm", className)}>
      {children}
    </div>
  );
}

/* ------------------------------------------------------------------ Modal */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "max-w-lg",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  maxWidth?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div
        className="absolute inset-0 bg-slate-900/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:rounded-2xl",
          maxWidth,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-slate-900">{title}</h2>
            {description && <p className="mt-0.5 text-sm text-slate-500">{description}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-slate-200 px-5 py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Forms */
export const inputClass =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500";

export function Field({
  label,
  hint,
  error,
  htmlFor,
  children,
  required,
}: {
  label: string;
  hint?: string;
  error?: string | null;
  htmlFor?: string;
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-slate-700"
      >
        {label}
        {required && <span className="text-red-600"> *</span>}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-red-600" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-slate-500">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  const { className, ...rest } = props;
  return <input {...rest} className={cn(inputClass, className)} />;
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className, ...rest } = props;
  return <textarea {...rest} className={cn(inputClass, className)} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  const { className, children, ...rest } = props;
  return (
    <select {...rest} className={cn(inputClass, className)}>
      {children}
    </select>
  );
}

/* ------------------------------------------------------- States / helpers */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-slate-200/80", className)} />;
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-5 w-5 animate-spin text-current", className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-slate-100 text-slate-500">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11a6 6 0 1 1-12 0 6 6 0 0 1 12 0Z" />
        </svg>
      </div>
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-12 text-center">
      <h3 className="text-sm font-semibold text-red-800">Something went wrong</h3>
      <p className="mt-1 max-w-md text-sm text-red-700">{message}</p>
      {onRetry && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex flex-wrap gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={active}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
              active
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-800",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  busy,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={title}
      maxWidth="max-w-md"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-slate-600">{message}</p>
    </Modal>
  );
}
