"use client";

import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  InformationCircleIcon,
  Loading03Icon,
  MultiplicationSignCircleIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// sonner's ToasterProps conflicts with exactOptionalPropertyTypes — cast to bypass
const SonnerAny = Sonner as React.ComponentType<Record<string, unknown>>;

const Toaster = (props: ToasterProps) => {
  const { theme } = useTheme();
  const themeProps =
    theme === undefined ? {} : { theme: theme as ToasterProps["theme"] };

  return (
    <SonnerAny
      className="toaster group"
      icons={{
        success: (
          <HugeiconsIcon
            className="size-4"
            icon={CheckmarkCircle02Icon}
            strokeWidth={2}
          />
        ),
        info: (
          <HugeiconsIcon
            className="size-4"
            icon={InformationCircleIcon}
            strokeWidth={2}
          />
        ),
        warning: (
          <HugeiconsIcon
            className="size-4"
            icon={Alert02Icon}
            strokeWidth={2}
          />
        ),
        error: (
          <HugeiconsIcon
            className="size-4"
            icon={MultiplicationSignCircleIcon}
            strokeWidth={2}
          />
        ),
        loading: (
          <HugeiconsIcon
            className="size-4 animate-spin"
            icon={Loading03Icon}
            strokeWidth={2}
          />
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...themeProps}
      {...(props as Record<string, unknown>)}
    />
  );
};

export { Toaster };
