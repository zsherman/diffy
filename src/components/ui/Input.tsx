import { Input as BaseInput } from "@base-ui/react/input";
import { forwardRef } from "react";

type InputSize = "sm" | "md" | "lg";
type InputVariant = "default" | "ghost";

interface InputProps extends React.ComponentProps<typeof BaseInput> {
  size?: InputSize;
  variant?: InputVariant;
}

const sizeStyles: Record<InputSize, string> = {
  sm: "px-2 py-1 text-xs",
  md: "px-2.5 py-1.5 text-sm",
  lg: "px-3 py-2 text-sm",
};

const variantStyles: Record<InputVariant, string> = {
  default: "bg-bg-tertiary border border-border-primary",
  ghost: "bg-transparent border border-border-primary",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ size = "md", variant = "default", className, style, ...props }, ref) => {
    return (
      <BaseInput
        ref={ref}
        className={`
          w-full rounded-md
          text-text-primary placeholder:text-text-muted
          transition-[border-color] duration-150
          outline-none focus:border-accent-blue
          disabled:opacity-50 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${className ?? ""}
        `}
        style={style}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";
