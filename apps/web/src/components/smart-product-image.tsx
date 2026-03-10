"use client";

import Image from "next/image";
import { useState } from "react";
import { ProductImageFallback } from "@/components/product-image-fallback";

type SmartProductImageProps = {
  src: string | null;
  alt: string;
  sku: string;
  name: string;
  brand?: string | null;
  compact?: boolean;
  width?: number;
  height?: number;
  imageClassName?: string;
  fallbackWrapperClassName?: string;
};

export function SmartProductImage({
  src,
  alt,
  sku,
  name,
  brand,
  compact = false,
  width = 720,
  height = 720,
  imageClassName = "h-full w-full object-cover",
  fallbackWrapperClassName = "h-full w-full",
}: SmartProductImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const hasImageError = Boolean(src && failedSrc === src);

  if (src && !hasImageError) {
    return (
      <Image
        src={src}
        alt={alt}
        className={imageClassName}
        width={width}
        height={height}
        onError={() => setFailedSrc(src)}
      />
    );
  }

  return (
    <div className={fallbackWrapperClassName}>
      <ProductImageFallback compact={compact} sku={sku} name={name} brand={brand} />
    </div>
  );
}
