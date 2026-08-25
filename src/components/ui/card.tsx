import type * as React from "react";

import { cn } from "@/lib/utils";

function Card({
  className,
  density = "default",
  size = "default",
  ...props
}: React.ComponentProps<"div"> & {
  density?: "default" | "compact";
  size?: "default" | "sm";
}) {
  return (
    <div
      className={cn(
        "group/card flex flex-col gap-(--card-spacing) overflow-hidden rounded-lg bg-card py-(--card-spacing) text-card-foreground text-sm shadow-sm ring-1 ring-foreground/5 [--card-spacing:--spacing(6)] has-[>img:first-child]:pt-0 dark:ring-foreground/10 data-[size=sm]:[--card-spacing:--spacing(4)] *:[img:first-child]:rounded-t-lg *:[img:last-child]:rounded-b-lg",
        density === "compact" && "!gap-0 !py-0",
        className
      )}
      data-density={density}
      data-size={size}
      data-slot="card"
      {...props}
    />
  );
}

function CardHeader({
  className,
  density = "default",
  ...props
}: React.ComponentProps<"div"> & {
  density?: "default" | "compact";
}) {
  return (
    <div
      className={cn(
        "group/card-header @container/card-header grid auto-rows-min items-start gap-1.5 rounded-t-lg px-(--card-spacing) has-data-[slot=card-action]:grid-cols-[1fr_auto] has-data-[slot=card-description]:grid-rows-[auto_auto] [.border-b]:pb-(--card-spacing)",
        density === "compact" && "!gap-1 !px-4 !py-2 !pb-2",
        className
      )}
      data-density={density}
      data-slot="card-header"
      {...props}
    />
  );
}

function CardTitle({
  as: Component = "div",
  className,
  ...props
}: React.ComponentProps<"div"> & {
  as?: "div" | "h1" | "h2" | "h3" | "h4";
}) {
  return (
    <Component
      className={cn("font-heading font-medium text-base", className)}
      data-slot="card-title"
      {...props}
    />
  );
}

function CardDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-muted-foreground text-sm", className)}
      data-slot="card-description"
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "col-start-2 row-span-2 row-start-1 self-start justify-self-end",
        className
      )}
      data-slot="card-action"
      {...props}
    />
  );
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("px-(--card-spacing)", className)}
      data-slot="card-content"
      {...props}
    />
  );
}

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "flex items-center rounded-b-lg px-(--card-spacing) [.border-t]:pt-(--card-spacing)",
        className
      )}
      data-slot="card-footer"
      {...props}
    />
  );
}

export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
};
