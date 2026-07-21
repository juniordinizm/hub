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
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div className="absolute inset-0 overflow-hidden">
      {isLoaded ? null : (
        <div
          aria-hidden="true"
          className={cn(
            "absolute inset-0 bg-muted",
            blurDataUrl
              ? "scale-105 bg-center bg-cover blur-sm"
              : "animate-pulse"
          )}
          style={
            blurDataUrl ? { backgroundImage: `url(${blurDataUrl})` } : undefined
          }
        />
      )}
      <Image
        alt={alt}
        {...(blurDataUrl ? { blurDataURL: blurDataUrl } : {})}
        className={cn(
          "object-cover transition-opacity duration-200",
          isLoaded ? "opacity-100" : "opacity-0",
          className
        )}
        fill
        onLoad={() => setIsLoaded(true)}
        placeholder={blurDataUrl ? "blur" : "empty"}
        preload={preload}
        sizes={sizes}
        src={src}
        unoptimized={unoptimized}
      />
    </div>
  );
}
