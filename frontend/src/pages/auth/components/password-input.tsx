import type { ComponentProps } from "react";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PasswordInputProps extends ComponentProps<typeof Input> {
  label: string;
  labelClassName?: string;
  inputClassName?: string;
}

export function PasswordInput({
  label,
  id,
  className,
  labelClassName,
  inputClassName,
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={id}
        className={labelClassName || "text-sm font-medium leading-none"}
      >
        {label}
      </label>
      <div className="relative">
        <Input
          id={id}
          type={visible ? "text" : "password"}
          className={
            inputClassName
              ? `${inputClassName} pr-10`
              : className
                ? `${className} pr-10`
                : "pr-10"
          }
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="absolute right-1 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
        >
          {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </Button>
      </div>
    </div>
  );
}
