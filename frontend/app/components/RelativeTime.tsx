"use client";

import React, { useEffect, useState } from "react";
import { formatRelativeTime } from "../utils";

interface RelativeTimeProps {
  dateString: string;
  fallback?: string;
  className?: string;
}

export function RelativeTime({
  dateString,
  fallback = "Recent",
  className,
}: RelativeTimeProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  return (
    <span suppressHydrationWarning className={className}>
      {mounted ? formatRelativeTime(dateString) : fallback}
    </span>
  );
}
