import { useCallback, useEffect, useState } from "react";
import { Spinner } from "@/components/ui/reui-spinner";
import { cn } from "@/lib/utils";

/**
 * Image that shows an optional placeholder (e.g. rarity artwork) instantly and
 * cross-fades to the real bitmap once it has decoded.
 */
export function LoadingImage({
  src,
  alt,
  placeholderSrc,
  className,
  wrapperClassName,
  spinnerClassName,
  eager = false,
}: {
  src: string;
  alt: string;
  placeholderSrc?: string | undefined;
  className?: string;
  wrapperClassName?: string;
  spinnerClassName?: string;
  eager?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setAttempt(0);
    setFailed(false);
  }, [src]);

  // If the bitmap is already in the browser cache the load event can fire
  // before React attaches its listener — check `complete` on mount.
  const imgRef = useCallback((el: HTMLImageElement | null) => {
    if (el && el.complete && el.naturalWidth > 0) setLoaded(true);
  }, []);

  // The metadata API can briefly 5xx while it re-renders freshly levelled
  // artwork; retry a few times instead of leaving a broken image on screen.
  const handleError = useCallback(() => {
    setAttempt((prev) => {
      if (prev >= 3) {
        setFailed(true);
        setLoaded(true);
        return prev;
      }
      window.setTimeout(() => setAttempt(prev + 1), 800 * (prev + 1));
      return prev;
    });
  }, []);

  const resolvedSrc = attempt > 0 ? `${src}${src.includes("?") ? "&" : "?"}r=${attempt}` : src;

  return (
    <div className={cn("relative", wrapperClassName)}>
      {placeholderSrc && !loaded && (
        <img
          src={placeholderSrc}
          alt=""
          aria-hidden
          className={cn("absolute inset-0", className)}
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        fetchPriority={eager ? "high" : "auto"}
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn(
          "relative transition-opacity duration-300",
          loaded ? "opacity-100" : "opacity-0",
          className,
        )}
      />
      {!loaded && (
        <div
          className={cn(
            "pointer-events-none absolute flex items-center justify-center rounded-[inherit]",
            placeholderSrc ? "bottom-3 right-3" : "inset-0 bg-black/5",
          )}
        >
          <Spinner
            className={cn(
              placeholderSrc ? "size-5 text-white drop-shadow" : "size-7 text-[#0038FF]",
              spinnerClassName,
            )}
          />
        </div>
      )}
    </div>
  );
}

export function LoadingBlock({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-center",
        className,
      )}
    >
      <Spinner className="size-8 text-[#0038FF]" />
      <p className="btn-text text-black/50">{label}</p>
    </div>
  );
}
