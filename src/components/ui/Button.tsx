import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger" | "whatsapp" | "outline";
  size?: "sm" | "md" | "lg" | "icon";
  loading?: boolean;
  fullWidth?: boolean;
  children: ReactNode;
}

const variants: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-accent text-white hover:bg-accent-dark shadow-sm focus-visible:ring-accent/40",
  whatsapp:
    "bg-wa-green text-black font-semibold hover:brightness-95 shadow-sm focus-visible:ring-wa-green/40",
  secondary:
    "bg-brand text-white hover:bg-brand-dark shadow-sm focus-visible:ring-brand/40",
  outline:
    "border border-stone-300 bg-white text-stone-700 hover:bg-stone-50 focus-visible:ring-stone-300",
  ghost: "text-stone-600 hover:bg-stone-100",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-400",
};

const sizes: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-base gap-2",
  icon: "h-9 w-9",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading,
  fullWidth,
  className = "",
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-xl font-medium transition-all
        focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none
        active:scale-[0.98] ${variants[variant]} ${sizes[size]} ${fullWidth ? "w-full" : ""} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading && (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
      )}
      {children}
    </button>
  );
}
