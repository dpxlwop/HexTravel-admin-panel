import { useLayoutEffect, useRef } from "react";

export function SelectionIndicator({ selected, selector }: { selected: string; selector: string }) {
  const indicator = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const marker = indicator.current;
    const track = marker?.parentElement;
    if (!marker || !track) return;

    const item = track.querySelector<HTMLElement>(selector);
    if (!item) {
      delete marker.dataset.ready;
      return;
    }

    const position = () => {
      marker.style.setProperty("--selection-x", `${item.offsetLeft}px`);
      marker.style.setProperty("--selection-y", `${item.offsetTop}px`);
      marker.style.width = `${item.offsetWidth}px`;
      marker.style.setProperty("--selection-height", `${item.offsetHeight}px`);
      marker.dataset.ready = "";
    };

    position();
    const observer = new ResizeObserver(position);
    observer.observe(track);
    observer.observe(item);
    return () => observer.disconnect();
  }, [selected, selector]);

  return <span ref={indicator} className="selection-indicator" aria-hidden="true"/>;
}
