"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface BannerImageProps {
  alt: string;
  blurDataUrl: string | null;
  className?: string;
  preload?: boolean;
  sizes: string;
  src: string;
  unoptimized?: boolean;
}

export function BannerImage({
  alt,
  blurDataUrl,
  className,
  preload = false,
  sizes,
  src,
  unoptimized = false,
}: BannerImageProps): React.JSX.Element {
  const [loadedSource, setLoadedSource] = useState<string | null>(null);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const isLoaded = loadedSource === src;
  const hasError = failedSource === src;

  let placeholder: React.JSX.Element | null = null;
  if (hasError) {
    placeholder = (
      <div aria-hidden="true" className="absolute inset-0 bg-muted" />
    );
  } else if (!isLoaded) {
    placeholder = (
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-muted",
          blurDataUrl ? "scale-105 bg-center bg-cover blur-sm" : "animate-pulse"
        )}
        style={
          blurDataUrl ? { backgroundImage: `url(${blurDataUrl})` } : undefined
        }
      />
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden">
      {placeholder}
      {hasError ? null : (
        <Image
          alt={alt}
          {...(blurDataUrl ? { blurDataURL: blurDataUrl } : {})}
          className={cn(
            "object-cover transition-opacity duration-200",
            isLoaded ? "opacity-100" : "opacity-0",
            className
          )}
          fill
          onError={() => {
            setFailedSource(src);
          }}
          onLoad={() => setLoadedSource(src)}
          placeholder={blurDataUrl ? "blur" : "empty"}
          preload={preload}
          sizes={sizes}
          src={src}
          unoptimized={unoptimized}
        />
      )}
    </div>
  );
}
