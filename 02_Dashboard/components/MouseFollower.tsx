import React, { useEffect, useState } from 'react';

export const MouseFollower: React.FC = () => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      if (!isVisible) setIsVisible(true);
    };

    const handleMouseLeave = () => {
      setIsVisible(false);
    };

    const handleMouseEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    document.addEventListener('mouseenter', handleMouseEnter);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      document.removeEventListener('mouseenter', handleMouseEnter);
    };
  }, [isVisible]);

  return (
    <>
      {/* 1. The BACKGROUND Atmospheric Blob (Low Z-Index) */}
      <div 
        className={`fixed inset-0 pointer-events-none z-10 transition-opacity duration-700 ease-in-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="absolute top-0 left-0 w-[500px] h-[500px] transition-transform duration-700 ease-out opacity-30 mix-blend-screen"
          style={{
            transform: `translate3d(${position.x - 250}px, ${position.y - 250}px, 0)`,
          }}
        >
          {/* Intense Inner Core */}
          <div className="absolute inset-[30%] bg-amethyst-400/40 rounded-full blur-[60px]"></div>
          
          {/* Large Outer Atmospheric Glow */}
          <div className="absolute inset-0 bg-amethyst-600/20 rounded-full blur-[110px]"></div>
          
          {/* Extra bright center point */}
          <div className="absolute inset-[45%] bg-white/10 rounded-full blur-[20px]"></div>
        </div>
      </div>

      {/* 2. The FOREGROUND Precision Cursor (High Z-Index) */}
      <div 
        className={`fixed inset-0 pointer-events-none z-[9999] transition-opacity duration-300 ease-in-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <div
          className="absolute top-0 left-0 transition-transform duration-75 ease-out"
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0)`,
          }}
        >
          {/* The Outer Precision Ring */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2 w-16 h-16 border border-amethyst-500/40 rounded-full shadow-[0_0_15px_rgba(121,71,189,0.2)]"></div>
          
          {/* The Center Dot */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-amethyst-400 rounded-full shadow-[0_0_8px_rgba(177,141,221,0.8)]"></div>
          
          {/* Subtle crosshair lines */}
          <div className="absolute -translate-x-1/2 -translate-y-1/2 w-[1px] h-2 bg-amethyst-500/20 -top-12"></div>
          <div className="absolute -translate-x-1/2 -translate-y-1/2 w-[1px] h-2 bg-amethyst-500/20 top-12"></div>
          <div className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-[1px] bg-amethyst-500/20 -left-12"></div>
          <div className="absolute -translate-x-1/2 -translate-y-1/2 w-2 h-[1px] bg-amethyst-500/20 left-12"></div>
        </div>
      </div>
    </>
  );
};