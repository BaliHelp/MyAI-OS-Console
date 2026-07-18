'use client';

import React, { useState, useEffect } from 'react';

interface GlobalLoaderProps {
  loading: boolean;
}

export default function GlobalLoader({ loading }: GlobalLoaderProps) {
  const [symbolIdx, setSymbolIdx] = useState(0);
  const [visible, setVisible] = useState(false);
  const symbols = ["</>", "<>", "><", "<>"];

  useEffect(() => {
    if (loading) {
      setVisible(true);
      const interval = setInterval(() => {
        setSymbolIdx((prev) => (prev + 1) % symbols.length);
      }, 250);
      return () => clearInterval(interval);
    } else {
      // Small fade-out delay
      const timeout = setTimeout(() => setVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [loading]);

  if (!visible) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-bento-border/70 bg-bento-surface/90 backdrop-blur-md shadow-2xl transition-all duration-300 transform ${
        loading ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-4 opacity-0 scale-95 pointer-events-none'
      }`}
    >
      <style dangerouslySetInnerHTML={{ __html: `
        .loader-symbol-container {
          perspective: 200px;
          display: inline-block;
          width: 32px;
          text-align: center;
        }
        .loader-symbol {
          display: inline-block;
          font-family: 'JetBrains Mono', monospace;
          font-size: 13px;
          font-weight: 800;
          color: #00E676;
          text-shadow: 0 0 10px rgba(0, 229, 255, 0.6);
          animation: tiltRotate 2s infinite linear;
          transform-style: preserve-3d;
        }
        @keyframes tiltRotate {
          0% {
            transform: rotateX(20deg) rotateY(0deg);
          }
          100% {
            transform: rotateX(20deg) rotateY(360deg);
          }
        }
      ` }} />
      <div className="loader-symbol-container">
        <span className="loader-symbol">{symbols[symbolIdx]}</span>
      </div>
      <div className="flex flex-col pr-1">
        <span className="text-[9px] font-extrabold text-bento-text-primary uppercase tracking-widest leading-none">Processing</span>
        <span className="text-[7.5px] font-semibold text-bento-text-secondary uppercase tracking-wider mt-0.5 opacity-80">MyAI OS Oracle</span>
      </div>
    </div>
  );
}
