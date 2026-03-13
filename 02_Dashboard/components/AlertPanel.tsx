import React from 'react';
import { AlertTriangle, AlertOctagon, Info, ArrowRight } from 'lucide-react';
import { BMSAlert, AlertSeverity } from '../types';

interface AlertPanelProps {
  alerts: BMSAlert[];
  isMini?: boolean;
  onViewAll?: () => void;
}

export const AlertPanel: React.FC<AlertPanelProps> = ({ alerts, isMini = false, onViewAll }) => {
  if (alerts.length === 0) {
    return (
      <div className="card-hover bg-dark-800/30 backdrop-blur-md shadow-xl border border-dark-700/50 rounded-2xl p-6 h-full flex flex-col items-center justify-center text-cyphgray font-doto">
        <div className="w-full flex justify-center mb-6">
          <h2 className="text-lg text-header-purple font-black uppercase tracking-[0.4em] border-b border-dark-700/30 pb-4 px-10">
            SYSTEM ALERTS
          </h2>
        </div>
        <div className="p-3 bg-dark-700/30 rounded-full mb-2">
          <Info size={24} className="text-amethyst-500/50" />
        </div>
        <span className="text-xs uppercase tracking-widest font-bold opacity-70">System Nominal</span>
      </div>
    );
  }

  // If mini, only show the first alert (most recent)
  const displayAlerts = isMini ? alerts.slice(0, 1) : alerts;

  return (
    <div className={`group card-hover bg-dark-800/30 backdrop-blur-md shadow-xl border border-dark-700/50 rounded-2xl p-6 h-full overflow-hidden flex flex-col font-doto relative`}>
      
      {/* Primary Centered Heading */}
      <div className="w-full flex justify-center mb-6 relative">
        <h2 className="text-lg text-header-purple font-black uppercase tracking-[0.4em] border-b border-dark-700/30 pb-4 px-10">
          SYSTEM ALERTS
        </h2>
        
        {isMini && onViewAll && (
          <button 
            onClick={onViewAll}
            className="absolute right-0 top-0 flex items-center gap-1 text-[8px] text-amethyst-400 font-black uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-amethyst-950/30 px-2 py-1 rounded-md border border-amethyst-500/30"
          >
            LOGS <ArrowRight size={10} />
          </button>
        )}
      </div>

      <div className={`pr-2 space-y-3 overflow-y-auto custom-scrollbar ${isMini ? 'max-h-[140px]' : 'flex-1'}`}>
        {displayAlerts.map((alert) => (
          <div 
            key={alert.id} 
            className={`p-4 rounded-xl border-l-4 flex gap-4 items-start transition-all ${
              alert.severity === AlertSeverity.CRITICAL 
                ? 'bg-red-950/20 border-red-500/50 shadow-[inset_0_0_20px_rgba(239,68,68,0.05)]' 
                : alert.severity === AlertSeverity.WARNING 
                  ? 'bg-yellow-950/20 border-yellow-500/50' 
                  : 'bg-blue-950/20 border-blue-500/50'
            }`}
          >
            <div className="mt-1 flex-shrink-0">
               {alert.severity === AlertSeverity.CRITICAL ? (
                 <AlertOctagon size={18} className="text-red-400 animate-pulse" />
               ) : (
                 <AlertTriangle size={18} className="text-yellow-400" />
               )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-black uppercase tracking-tight leading-relaxed ${
                alert.severity === AlertSeverity.CRITICAL ? 'text-red-400' : 'text-gray-200'
              }`}>
                {alert.message}
              </p>
              <div className="flex justify-between w-full mt-3 border-t border-white/5 pt-2 font-handjet font-extralight">
                <span className="text-[14px] text-cyphgray uppercase">{alert.code}</span>
                <span className="text-[14px] text-cyphgray uppercase tracking-widest">{new Date(alert.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            </div>
          </div>
        ))}
        
        {isMini && alerts.length > 1 && (
          <div className="text-center pt-2">
            <span className="text-[9px] text-cyphgray uppercase font-black tracking-[0.4em] opacity-80">
              + {alerts.length - 1} QUEUED ENTRIES
            </span>
          </div>
        )}
      </div>

      {isMini && onViewAll && (
        <button 
          onClick={onViewAll}
          className="absolute inset-x-0 bottom-0 top-12 z-10 cursor-pointer hidden sm:block"
          title="Click to view all logs"
        />
      )}
    </div>
  );
};