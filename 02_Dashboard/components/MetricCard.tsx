import React, { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: ReactNode;
  status?: 'normal' | 'warning' | 'critical';
  subtext?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  unit, 
  icon, 
  status = 'normal',
  subtext
}) => {
  let borderColor = 'border-dark-700';
  let glowClass = '';

  if (status === 'warning') {
    borderColor = 'border-yellow-500';
    glowClass = 'shadow-[0_0_10px_rgba(234,179,8,0.2)]';
  } else if (status === 'critical') {
    borderColor = 'border-red-500';
    glowClass = 'shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse';
  }

  return (
    <div className={`card-hover bg-dark-800/50 backdrop-blur-md border ${borderColor} ${glowClass} rounded-xl p-4 flex flex-col justify-between font-doto`}>
      <div className="flex justify-between items-start mb-2">
        <span className="text-gray-400 text-[10px] uppercase tracking-widest font-bold">{title}</span>
        <div className={`${status === 'critical' ? 'text-red-400' : status === 'warning' ? 'text-yellow-400' : 'text-amethyst-400'}`}>
          {icon}
        </div>
      </div>
      <div className="flex items-end gap-1">
        <span className="text-4xl font-handjet font-extralight text-white leading-none">{value}</span>
        {unit && <span className="text-xs text-gray-500 mb-0.5 uppercase font-bold tracking-tighter">{unit}</span>}
      </div>
      {subtext && (
        <div className="mt-2 text-[10px] text-gray-500 border-t border-dark-700 pt-2 uppercase tracking-tighter">
          {subtext}
        </div>
      )}
    </div>
  );
};