import type { ButtonHTMLAttributes } from "react";

const baseClass =
  "inline-flex items-center justify-center rounded-lg bg-foreground px-6 py-3 font-medium text-background transition-colors hover:opacity-90 disabled:opacity-50";

export function PrimaryButton({
  children,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`${baseClass} ${className}`} {...props}>
      {children}
    </button>
  );
}

export const primaryButtonClass = baseClass;
