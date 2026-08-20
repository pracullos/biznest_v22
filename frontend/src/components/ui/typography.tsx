import type { ReactNode, HTMLAttributes, ElementType } from "react";
import { cn } from "@/lib/utils";

interface TypographyProps extends HTMLAttributes<HTMLElement> {
  children: ReactNode;
  as?: ElementType;
}

export function H1({
  children,
  className,
  as: Component = "h1",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "scroll-m-20 text-5xl text-foreground font-semibold tracking-tight text-balance",
        className,
      )}
      data-slot="typography-h1"
      {...props}
    >
      {children}
    </Component>
  );
}

export function H2({
  children,
  className,
  as: Component = "h2",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "scroll-m-20 border-b pb-2 text-4xl font-semibold tracking-tight first:mt-0",
        className,
      )}
      data-slot="typography-h2"
      {...props}
    >
      {children}
    </Component>
  );
}

export function H3({
  children,
  className,
  as: Component = "h3",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "scroll-m-20 text-2xl font-semibold tracking-tight",
        className,
      )}
      data-slot="typography-h3"
      {...props}
    >
      {children}
    </Component>
  );
}

export function H4({
  children,
  className,
  as: Component = "h4",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "scroll-m-20 text-xl font-semibold tracking-tight",
        className,
      )}
      data-slot="typography-h4"
      {...props}
    >
      {children}
    </Component>
  );
}

export function P({
  children,
  className,
  as: Component = "p",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={cn("leading-7 [&:not(:first-child)]:mt-6", className)}
      data-slot="typography-p"
      {...props}
    >
      {children}
    </Component>
  );
}

export function Muted({
  children,
  className,
  as: Component = "p",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={cn("text-foreground/70 text-sm", className)}
      data-slot="typography-muted"
      {...props}
    >
      {children}
    </Component>
  );
}

export function Large({
  children,
  className,
  as: Component = "div",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={cn("text-lg font-semibold", className)}
      data-slot="typography-large"
      {...props}
    >
      {children}
    </Component>
  );
}

export function Small({
  children,
  className,
  as: Component = "small",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={cn("text-sm leading-none font-medium", className)}
      data-slot="typography-small"
      {...props}
    >
      {children}
    </Component>
  );
}

export function Lead({
  children,
  className,
  as: Component = "p",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={cn("text-xl text-muted-foreground", className)}
      data-slot="typography-lead"
      {...props}
    >
      {children}
    </Component>
  );
}

export function Blockquote({
  children,
  className,
  as: Component = "blockquote",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={cn("mt-6 border-l-2 pl-6 italic", className)}
      data-slot="typography-blockquote"
      {...props}
    >
      {children}
    </Component>
  );
}

export function InlineCode({
  children,
  className,
  as: Component = "code",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={cn(
        "relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm font-semibold",
        className,
      )}
      data-slot="typography-inline-code"
      {...props}
    >
      {children}
    </Component>
  );
}

export function List({
  children,
  className,
  as: Component = "ul",
  ...props
}: TypographyProps) {
  return (
    <Component
      className={cn("my-6 ml-6 list-disc [&>li]:mt-2", className)}
      data-slot="typography-list"
      {...props}
    >
      {children}
    </Component>
  );
}
