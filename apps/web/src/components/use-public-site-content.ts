"use client";

import { useEffect, useMemo, useState } from "react";
import {
  fetchPublicContentMapClient,
  getPublicContentValue,
  getPublicSiteContent,
  type PublicContentMap,
} from "@/lib/public-site-content";

export function usePublicContentMap(): PublicContentMap {
  const [contentMap, setContentMap] = useState<PublicContentMap>({});

  useEffect(() => {
    let cancelled = false;

    async function loadContent() {
      const loadedMap = await fetchPublicContentMapClient();
      if (cancelled) {
        return;
      }
      setContentMap(loadedMap);
    }

    void loadContent();
    return () => {
      cancelled = true;
    };
  }, []);

  return contentMap;
}

export function usePublicSiteContent() {
  const contentMap = usePublicContentMap();
  const siteContent = useMemo(
    () => getPublicSiteContent(contentMap),
    [contentMap],
  );
  const contentValue = (key: string, fallback: string): string =>
    getPublicContentValue(contentMap, key, fallback);

  return {
    contentMap,
    contentValue,
    brandName: siteContent.brandName,
    footerText: siteContent.footerText,
    labels: siteContent.labels,
  };
}
