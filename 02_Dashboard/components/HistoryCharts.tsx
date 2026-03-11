import React from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { HistoryPoint } from '../types';

interface HistoryChartsProps {
  data: HistoryPoint[];
  type?: 'all' | 'voltage' | 'temp';
}

export const HistoryCharts: React.FC<HistoryChartsProps> = ({ data, type = 'all' }) => {
  const showVoltage = type === 'all' || type === 'voltage';
  const showTemp = type === 'all' || type === 'temp';

  return (
    <div className={`grid grid-cols-1 ${type === 'all' ? 'lg:grid-cols-2' : 'grid-cols-1'} gap-4 h-full`}>
      {/* Voltage Chart */}
      {showVoltage && (
        <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4 min-h-[250px]">
          <h3 className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-4">Pack Voltage Trend</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4A5665" opacity={0.5} />
                <XAxis 
                  dataKey="time" 
                  stroke="#94a3b8" 
                  tick={{fontSize: 10}} 
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  stroke="#94a3b8" 
                  tick={{fontSize: 10}} 
                  width={30}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#37424E', borderColor: '#7947BD', color: '#fff' }}
                  itemStyle={{ color: '#7947BD' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="voltage" 
                  stroke="#7947BD" 
                  strokeWidth={2} 
                  dot={false}
                  activeDot={{ r: 6, fill: '#b18ddd' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Temperature Chart */}
      {showTemp && (
        <div className="bg-dark-800/50 border border-dark-700 rounded-xl p-4 min-h-[250px]">
          <h3 className="text-gray-400 text-xs uppercase tracking-wider font-semibold mb-4">Thermal Consistency</h3>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4A5665" opacity={0.5} />
                <XAxis 
                  dataKey="time" 
                  stroke="#94a3b8" 
                  tick={{fontSize: 10}} 
                  interval="preserveStartEnd"
                />
                <YAxis 
                  domain={['auto', 'auto']} 
                  stroke="#94a3b8" 
                  tick={{fontSize: 10}} 
                  width={30}
                />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#37424E', borderColor: '#7947BD', color: '#fff' }}
                  itemStyle={{ color: '#f59e0b' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="temp" 
                  stroke="#f59e0b" 
                  strokeWidth={2} 
                  dot={false} 
                  activeDot={{ r: 6, fill: '#fcd34d' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
};