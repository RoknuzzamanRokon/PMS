"use client";

import { useRef, useEffect, useCallback, useMemo, useState } from "react";
import { gsap } from "gsap";

function throttle(func, limit) {
  let lastCall = 0;
  return (...args) => {
    const now = performance.now();
    if (now - lastCall >= limit) {
      lastCall = now;
      func(...args);
    }
  };
}

function hexToRgb(hex) {
  const match = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!match) return { r: 0, g: 0, b: 0 };
  return {
    r: parseInt(match[1], 16),
    g: parseInt(match[2], 16),
    b: parseInt(match[3], 16),
  };
}

function createCirclePath(radius) {
  if (typeof window === "undefined") return null;
  if (window.Path2D) {
    const path = new Path2D();
    path.arc(0, 0, radius, 0, Math.PI * 2);
    return path;
  }
  return null;
}

export function DotGrid({
  dotSize = 14,
  gap = 36,

  // light mode colors
  baseColor = "#C4B5FD",
  activeColor = "#A78BFA",

  // dark mode colors
  darkBaseColor = "#6D5BD0",
  darkActiveColor = "#C4B5FD",

  proximity = 180,
  speedTrigger = 60,
  shockRadius = 220,
  shockStrength = 2.5,
  maxSpeed = 3000,
  returnDuration = 2.2,
  className = "",
  style,
  forceDark = false,
}) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const dotsRef = useRef([]);
  const [isDark, setIsDark] = useState(forceDark);

  const pointerRef = useRef({
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    lastTime: 0,
    lastX: 0,
    lastY: 0,
  });

  useEffect(() => {
    if (forceDark) {
      setIsDark(true);
      return;
    }

    const getDarkMode = () => {
      if (typeof document === "undefined") return false;
      // Only check the site's own dark class — never the OS preference
      return document.documentElement.classList.contains("dark");
    };

    setIsDark(getDarkMode());

    const observer = new MutationObserver(() => {
      setIsDark(getDarkMode());
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => {
      observer.disconnect();
    };
  }, [forceDark]);

  const resolvedBaseColor = isDark ? darkBaseColor : baseColor;
  const resolvedActiveColor = isDark ? darkActiveColor : activeColor;

  const baseRgb = useMemo(
    () => hexToRgb(resolvedBaseColor),
    [resolvedBaseColor],
  );
  const activeRgb = useMemo(
    () => hexToRgb(resolvedActiveColor),
    [resolvedActiveColor],
  );
  const circlePath = useMemo(() => createCirclePath(dotSize / 2.2), [dotSize]);

  const propsRef = useRef({
    proximity,
    speedTrigger,
    maxSpeed,
    returnDuration,
    shockRadius,
    shockStrength,
  });

  useEffect(() => {
    propsRef.current = {
      proximity,
      speedTrigger,
      maxSpeed,
      returnDuration,
      shockRadius,
      shockStrength,
    };
  }, [
    proximity,
    speedTrigger,
    maxSpeed,
    returnDuration,
    shockRadius,
    shockStrength,
  ]);

  const buildGrid = useCallback(() => {
    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrapper || !canvas) return;

    for (const dot of dotsRef.current) gsap.killTweensOf(dot);

    const { width, height } = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.scale(dpr, dpr);
    }

    const cols = Math.floor((width + gap) / (dotSize + gap));
    const rows = Math.floor((height + gap) / (dotSize + gap));
    const cell = dotSize + gap;
    const startX = (width - (cell * cols - gap)) / 2 + dotSize / 2;
    const startY = (height - (cell * rows - gap)) / 2 + dotSize / 2;

    const newDots = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        newDots.push({
          cx: startX + col * cell,
          cy: startY + row * cell,
          xOffset: 0,
          yOffset: 0,
          _isAnimating: false,
        });
      }
    }

    dotsRef.current = newDots;
  }, [dotSize, gap]);

  useEffect(() => {
    let animationId;

    const draw = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const { x: pointerX, y: pointerY } = pointerRef.current;
      const proxSq = propsRef.current.proximity ** 2;

      for (const dot of dotsRef.current) {
        const drawX = dot.cx + dot.xOffset;
        const drawY = dot.cy + dot.yOffset;

        const dx = dot.cx - pointerX;
        const dy = dot.cy - pointerY;
        const distSq = dx * dx + dy * dy;

        let fillStyle = isDark
          ? `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, 0.32)`
          : `rgba(${baseRgb.r}, ${baseRgb.g}, ${baseRgb.b}, 0.55)`;

        if (distSq <= proxSq) {
          const t = 1 - Math.sqrt(distSq) / propsRef.current.proximity;
          const r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * t);
          const g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * t);
          const b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * t);
          const alpha = isDark ? 0.32 + t * 0.5 : 0.55 + t * 0.35;
          fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        }

        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.fillStyle = fillStyle;
        ctx.shadowColor = fillStyle;
        ctx.shadowBlur = isDark ? 14 : 10;
        ctx.globalAlpha = isDark ? 0.95 : 0.85;

        if (circlePath) {
          ctx.fill(circlePath);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, dotSize / 2.2, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.restore();
      }

      animationId = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [baseRgb, activeRgb, dotSize, circlePath, isDark]);

  useEffect(() => {
    buildGrid();

    let resizeObserver = null;
    if (typeof window !== "undefined" && "ResizeObserver" in window) {
      resizeObserver = new ResizeObserver(() => buildGrid());
      if (wrapperRef.current) resizeObserver.observe(wrapperRef.current);
    } else {
      window.addEventListener("resize", buildGrid);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      else window.removeEventListener("resize", buildGrid);
    };
  }, [buildGrid]);

  const handlePointerMove = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const now = performance.now();
    const pointer = pointerRef.current;
    const dt = pointer.lastTime ? now - pointer.lastTime : 16;

    let vx = ((clientX - pointer.lastX) / dt) * 1000;
    let vy = ((clientY - pointer.lastY) / dt) * 1000;
    let speed = Math.hypot(vx, vy);

    const maxSpd = propsRef.current.maxSpeed;
    if (speed > maxSpd) {
      const s = maxSpd / speed;
      vx *= s;
      vy *= s;
      speed = maxSpd;
    }

    pointer.lastTime = now;
    pointer.lastX = clientX;
    pointer.lastY = clientY;
    pointer.vx = vx;
    pointer.vy = vy;
    pointer.speed = speed;

    const rect = canvas.getBoundingClientRect();
    pointer.x = clientX - rect.left;
    pointer.y = clientY - rect.top;

    const {
      speedTrigger: trig,
      proximity: prox,
      returnDuration: retDur,
    } = propsRef.current;

    for (const dot of dotsRef.current) {
      const dist = Math.hypot(dot.cx - pointer.x, dot.cy - pointer.y);

      if (speed > trig && dist < prox && !dot._isAnimating) {
        dot._isAnimating = true;
        gsap.killTweensOf(dot);

        gsap.to(dot, {
          xOffset: (dot.cx - pointer.x) * 0.4 + vx * 0.002,
          yOffset: (dot.cy - pointer.y) * 0.4 + vy * 0.002,
          duration: 0.35,
          ease: "sine.out",
          onComplete: () => {
            gsap.to(dot, {
              xOffset: 0,
              yOffset: 0,
              duration: retDur,
              ease: "power3.out",
              onComplete: () => {
                dot._isAnimating = false;
              },
            });
          },
        });
      }
    }
  }, []);

  const handleShock = useCallback((clientX, clientY) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = clientX - rect.left;
    const clickY = clientY - rect.top;

    const {
      shockRadius: radius,
      shockStrength: strength,
      returnDuration: retDur,
    } = propsRef.current;

    for (const dot of dotsRef.current) {
      const dist = Math.hypot(dot.cx - clickX, dot.cy - clickY);

      if (dist < radius && !dot._isAnimating) {
        dot._isAnimating = true;
        gsap.killTweensOf(dot);

        const falloff = Math.max(0, 1 - dist / radius);

        gsap.to(dot, {
          xOffset: (dot.cx - clickX) * strength * falloff * 0.12,
          yOffset: (dot.cy - clickY) * strength * falloff * 0.12,
          duration: 0.4,
          ease: "sine.out",
          onComplete: () => {
            gsap.to(dot, {
              xOffset: 0,
              yOffset: 0,
              duration: retDur,
              ease: "power3.out",
              onComplete: () => {
                dot._isAnimating = false;
              },
            });
          },
        });
      }
    }
  }, []);

  useEffect(() => {
    const onMouseMove = (e) => handlePointerMove(e.clientX, e.clientY);

    const onTouchMove = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) handlePointerMove(t.clientX, t.clientY);
    };

    const onMouseClick = (e) => handleShock(e.clientX, e.clientY);

    const onTouchStart = (e) => {
      e.preventDefault();
      const t = e.touches[0];
      if (t) handleShock(t.clientX, t.clientY);
    };

    const throttledMouseMove = throttle(onMouseMove, 50);
    const throttledTouchMove = throttle(onTouchMove, 50);

    window.addEventListener("mousemove", throttledMouseMove);
    window.addEventListener("click", onMouseClick);
    window.addEventListener("touchmove", throttledTouchMove, {
      passive: false,
    });
    window.addEventListener("touchstart", onTouchStart, { passive: false });

    return () => {
      window.removeEventListener("mousemove", throttledMouseMove);
      window.removeEventListener("click", onMouseClick);
      window.removeEventListener("touchmove", throttledTouchMove);
      window.removeEventListener("touchstart", onTouchStart);
    };
  }, [handlePointerMove, handleShock]);

  useEffect(() => {
    return () => {
      for (const dot of dotsRef.current) gsap.killTweensOf(dot);
    };
  }, []);

  const backgroundStyle = isDark
    ? "radial-gradient(circle at center, rgba(20,20,32,0.96) 0%, rgba(12,12,22,0.98) 48%, rgba(6,6,14,1) 100%)"
    : "radial-gradient(circle at center, rgba(245,243,255,0.9) 0%, rgba(237,233,254,0.75) 45%, rgba(255,255,255,0.95) 100%)";

  return (
    <section
      className={`relative flex h-full w-full items-center justify-center overflow-hidden p-4 ${className}`}
      style={{
        background: "transparent",
        ...style,
      }}
    >
      <div ref={wrapperRef} className="relative h-full w-full">
        <canvas
          ref={canvasRef}
          className="pointer-events-none absolute inset-0 h-full w-full"
          style={{
            willChange: "transform",
            filter: isDark ? "blur(0.3px)" : "blur(0.2px)",
          }}
        />
      </div>
    </section>
  );
}

export default DotGrid;
