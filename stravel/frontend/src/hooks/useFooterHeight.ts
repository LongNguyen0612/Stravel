import { useEffect, useRef, useState } from 'react';

export function useFooterHeight(refs: React.RefObject<HTMLElement | null>[]): number {
  const [height, setHeight] = useState(0);
  // Store refs array as a ref to avoid re-creating the observer on each render
  const refsRef = useRef(refs);
  refsRef.current = refs;

  useEffect(() => {
    const measure = () => {
      const total = refsRef.current.reduce((sum, ref) => {
        return sum + (ref.current?.getBoundingClientRect().height ?? 0);
      }, 0);
      setHeight(total);
    };

    const observer = new ResizeObserver(measure);
    refsRef.current.forEach((ref) => {
      if (ref.current) observer.observe(ref.current);
    });
    measure();

    return () => observer.disconnect();
    // Empty deps intentional: refs captured via refsRef to avoid re-creating the observer
  }, []);

  return height;
}
