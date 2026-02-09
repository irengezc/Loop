"use client";

import { useRef, useEffect, type TextareaHTMLAttributes } from "react";

export function CanvasTextarea({
  className = "",
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const resize = () => {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    };

    resize();
    el.addEventListener("input", resize);
    return () => el.removeEventListener("input", resize);
  }, []);

  return (
    <textarea
      ref={ref}
      rows={8}
      className={`min-h-[60vh] w-full resize-none border-0 bg-transparent p-0 text-xl leading-loose text-foreground placeholder:text-zinc-400/60 focus:outline-none focus:ring-0 dark:placeholder:text-zinc-500/50 ${className}`}
      {...props}
    />
  );
}
