import * as React from "react";
import { cn } from "@/lib/utils";
import { maskPhone } from "@/lib/masks";

interface MaskedInputProps extends Omit<React.ComponentProps<"input">, "onChange"> {
  mask: "phone";
  onValueChange: (raw: string, masked: string) => void;
}

const maskFns = { phone: maskPhone };

const MaskedInput = React.forwardRef<HTMLInputElement, MaskedInputProps>(
  ({ className, mask, value, onValueChange, ...props }, ref) => {
    const applyMask = maskFns[mask];

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const masked = applyMask(e.target.value);
      onValueChange(e.target.value.replace(/\D/g, ""), masked);
    };

    return (
      <input
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        value={value}
        onChange={handleChange}
        {...props}
      />
    );
  },
);
MaskedInput.displayName = "MaskedInput";

export { MaskedInput };
