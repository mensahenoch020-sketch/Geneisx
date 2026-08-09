import React, { useEffect, useRef } from "react";

const COLORS = ["#0F9D63", "#F7931A", "#8C8CFF", "#B8790F", "#3AA1E0", "#9945FF"];

// A short celebratory burst when a client successfully buys a plan — pure
// canvas, no new npm dependency. Removes itself after the animation ends.
export default function Confetti({ onDone }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.scale(dpr, dpr);

    const count = 140;
    const particles = Array.from({ length: count }, () => ({
      x: window.innerWidth / 2 + (Math.random() - 0.5) * 120,
      y: window.innerHeight * 0.25 + (Math.random() - 0.5) * 40,
      vx: (Math.random() - 0.5) * 9,
      vy: Math.random() * -9 - 4,
      size: Math.random() * 6 + 4,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      shape: Math.random() > 0.5 ? "rect" : "circle",
    }));

    let frame = 0;
    const gravity = 0.28;
    let raf;

    function tick() {
      frame++;
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let anyAlive = false;

      for (const p of particles) {
        p.vy += gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;
        const opacity = Math.max(0, 1 - frame / 110);
        if (p.y < window.innerHeight + 20 && opacity > 0) anyAlive = true;

        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx.fillRect(-p.size / 2, -p.size / 3, p.size, p.size * 0.6);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

      if (anyAlive && frame < 130) {
        raf = requestAnimationFrame(tick);
      } else {
        onDone?.();
      }
    }
    raf = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        pointerEvents: "none",
      }}
    />
  );
}
