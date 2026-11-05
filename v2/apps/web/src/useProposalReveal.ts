import { useEffect, useRef } from "react";
// Progressive enhancement: content is visible unless motion is explicitly enabled.
export function useProposalReveal(
  key: string,
  selector = "[data-proposal-reveal]",
) {
  const root = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const node = root.current;
    if (!node || !window.matchMedia || !("IntersectionObserver" in window))
      return;
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let observer: IntersectionObserver | undefined;
    const revealAll = () =>
      node
        .querySelectorAll(".proposal-reveal-pending")
        .forEach((element) =>
          element.classList.remove("proposal-reveal-pending"),
        );
    const setup = () => {
      observer?.disconnect();
      revealAll();
      if (motion.matches) return;
      observer = new IntersectionObserver(
        (entries) =>
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.remove("proposal-reveal-pending");
              observer?.unobserve(entry.target);
            }
          }),
        { threshold: 0.05 },
      );
      node.querySelectorAll(selector).forEach((element) => {
        if (element.getBoundingClientRect().top > window.innerHeight) {
          element.classList.add("proposal-reveal-pending");
          observer!.observe(element);
        }
      });
    };
    setup();
    motion.addEventListener?.("change", setup);
    return () => {
      observer?.disconnect();
      motion.removeEventListener?.("change", setup);
      revealAll();
    };
  }, [key, selector]);
  return root;
}
