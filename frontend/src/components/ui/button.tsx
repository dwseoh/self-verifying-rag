import Link from "next/link";
import { ReactNode } from "react";

const base =
  "inline-flex items-center justify-center font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none";

const variants = {
  primary: `${base} bg-ink text-on-primary hover:bg-[#333]`,
  secondary: `${base} bg-canvas text-ink border border-hairline hover:bg-canvas-soft-2`,
  ghost: `${base} bg-transparent text-body hover:text-ink hover:bg-canvas-soft-2`,
  danger: `${base} bg-error text-on-primary hover:bg-error/90`,
};

const sizes = {
  sm: "h-7 px-3 text-sm rounded-sm",
  md: "h-10 px-4 text-sm rounded-sm",
  lg: "h-12 px-6 text-base rounded-pill",
};

type ButtonProps = {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  href?: string;
  className?: string;
  children: ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({
  variant = "primary",
  size = "md",
  href,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const cls = `${variants[variant]} ${sizes[size]} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cls} {...props}>
      {children}
    </button>
  );
}
