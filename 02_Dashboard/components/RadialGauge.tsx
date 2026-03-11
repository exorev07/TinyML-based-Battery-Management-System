import React from 'react';

interface RadialGaugeProps {
  value: number;
  max: number;
  label: string;
  unit: string;
  color?: string;
  size?: number;
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({ 
  value, 
  max, 
  label, 
  unit, 
  color = "text-amethyst-500", 
  size = 180 
}) => {
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  // Ensure we don't exceed max for visual overflow, clamp between 0 and 1
  const percentage = Math.max(0, Math.min(1, value / max));
  const offset = circumference - percentage * circumference;

  // Scale fonts based on size
  const valFontSize = size > 150 ? 'text-5xl' : 'text-3xl';
  const unitFontSize = size > 150 ? 'text-xs' : 'text-[9px]';
  const labelFontSize = size > 150 ? 'text-sm' : 'text-[10px]';

  return (
    <div className="flex flex-col items-center font-doto">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg className="transform -rotate-90 w-full h-full">
          {/* Background Circle */}
          <circle
            className="text-dark-700/50"
            strokeWidth={strokeWidth}
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
          {/* Progress Circle */}
          <circle
            className={`${color} transition-all duration-1000 ease-out`}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            stroke="currentColor"
            fill="transparent"
            r={radius}
            cx={size / 2}
            cy={size / 2}
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-white text-center px-1">
          <span className={`${valFontSize} font-handjet font-extralight tracking-tight`}>{value}</span>
          <span className={`${unitFontSize} text-cyphgray uppercase tracking-widest font-black mt-1`}>{unit}</span>
        </div>
      </div>
      <div className={`mt-3 w-max text-center font-black text-cyphgray tracking-[0.2em] uppercase ${labelFontSize}`}>
        {label}
      </div>
    </div>
  );
};