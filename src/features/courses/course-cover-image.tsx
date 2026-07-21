"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface CourseCoverImageProps {
  alt: string;
  blurDataUrl: string | null;
  className?: string;
  sizes: string;
  src: string;
}

export function CourseCoverImage({
  alt,
  blurDataUrl,
  className,
  sizes,
  src,
}: CourseCoverImageProps): React.JSX.Element {
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
        sizes={sizes}
        src={src}
        unoptimized
      />
    </div>
  );
}
