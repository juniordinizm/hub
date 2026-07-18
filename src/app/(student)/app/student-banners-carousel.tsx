"use client";

import { Link01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import Autoplay from "embla-carousel-autoplay";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import type { AdminBanner } from "@/features/admin/server";
import { BannerImage } from "@/features/banners/banner-image";

interface StudentBannersCarouselProps {
  banners: AdminBanner[];
}

export function StudentBannersCarousel({
  banners,
}: StudentBannersCarouselProps) {
  if (banners.length === 0) {
    return null;
  }

  return (
    <section className="relative w-full">
      {/* 
        We use an inner div to apply the concentric border-radius & subtle outline 
        ensuring the carousel itself masks overflow correctly. 
      */}
      <div className="overflow-hidden rounded-3xl border border-black/10 shadow-sm dark:border-white/10">
        <Carousel
          className="w-full"
          opts={{
            loop: true,
            align: "center",
            watchDrag: banners.length > 1,
          }}
          plugins={[
            Autoplay({
              delay: 6000,
              stopOnInteraction: true,
            }),
          ]}
        >
          <CarouselContent>
            {banners.map((banner, index) => (
              <CarouselItem
                className="relative aspect-[4/1] w-full"
                key={banner.id}
              >
                <div className="absolute inset-0">
                  <BannerImage
                    alt="Banner"
                    blurDataUrl={banner.blurDataUrl}
                    key={banner.imageUrl}
                    preload={index === 0}
                    sizes="100vw"
                    src={banner.imageUrl}
                    unoptimized
                  />

                  {banner.linkUrl && banner.buttonText && (
                    <div className="absolute right-4 bottom-4 z-10 sm:right-6 sm:bottom-6 lg:right-8 lg:bottom-8">
                      <Button
                        asChild
                        className="bg-primary text-primary-foreground shadow-sm transition-transform hover:bg-primary/90 active:scale-96 max-sm:h-7 max-sm:gap-1 max-sm:px-2 max-sm:text-[10px]"
                        size="default"
                      >
                        <Link
                          href={banner.linkUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {banner.buttonText}
                          <HugeiconsIcon
                            className="ml-2 h-4 w-4 max-sm:ml-1 max-sm:h-3 max-sm:w-3"
                            icon={Link01Icon}
                          />
                        </Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>
    </section>
  );
}
