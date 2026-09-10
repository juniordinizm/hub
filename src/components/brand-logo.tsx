import Image from "next/image";
import { PLATFORM_BRAND, PLATFORM_LOGO_SRC } from "@/lib/brand";

interface BrandLogoProps {
  readonly className?: string;
  readonly preload?: boolean;
}

export function BrandLogo({
  className,
  preload = false,
}: BrandLogoProps): React.JSX.Element {
  return (
    <Image
      alt={PLATFORM_BRAND}
      className={className}
      height={334}
      preload={preload}
      src={PLATFORM_LOGO_SRC}
      unoptimized
      width={1042}
    />
  );
}
