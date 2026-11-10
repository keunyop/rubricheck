"use client";

import { useEffect, useRef } from "react";
import { trackQuiz, type QuizPlacement } from "../../src/lib/quizAnalytics";

export function useQuizDiscovery<T extends HTMLElement>(placement: QuizPlacement) {
  const element = useRef<T>(null);
  useEffect(() => {
    if (!element.current || typeof IntersectionObserver === "undefined") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;
    function record() {
      // The GA4 queue initializes after hydration. Retry briefly rather than
      // permanently losing an initial visible impression before it is ready.
      if (trackQuiz("quiz_discovery_viewed", placement) || ++attempts >= 10) { observer.disconnect(); return; }
      timer = setTimeout(record, 100);
    }
    const observer = new IntersectionObserver(entries => {
      clearTimeout(timer);
      if (!entries.some(entry => entry.isIntersecting && entry.intersectionRatio >= 0.5)) return;
      record();
    }, { threshold: 0.5 });
    observer.observe(element.current);
    return () => { clearTimeout(timer); observer.disconnect(); };
  }, [placement]);
  return element;
}
