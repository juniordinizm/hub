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
    <section className="relative mb-8 w-full">
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
          }}
          plugins={[
            Autoplay({
              delay: 6000,
              stopOnInteraction: true,
            }),
          ]}
        >
          <CarouselContent>
            {banners.map((banner) => (
              <CarouselItem
                className="relative aspect-[4/1] w-full sm:aspect-[5/1] lg:aspect-[6/1]"
                key={banner.id}
              >
                <div className="absolute inset-0">
                  {/* biome-ignore lint/correctness/useImageSize: Dynamic banner image */}
                  {/* biome-ignore lint/performance/noImgElement: Native img required */}
                  <img
                    alt="Banner"
                    className="h-full w-full object-cover"
                    src={`/api/banners/${banner.id}/image`}
                  />

                  {banner.linkUrl && banner.buttonText && (
                    <div className="absolute right-4 bottom-4 z-10 sm:right-6 sm:bottom-6 lg:right-8 lg:bottom-8">
                      <Button
                        asChild
                        className="bg-primary text-primary-foreground shadow-sm transition-transform hover:bg-primary/90 active:scale-96"
                        size="default"
                      >
                        <Link
                          href={banner.linkUrl}
                          rel="noopener noreferrer"
                          target="_blank"
                        >
                          {banner.buttonText}
                          <HugeiconsIcon
                            className="ml-2 h-4 w-4"
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
