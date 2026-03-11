import { useState, useEffect } from 'react';
import { BMSData, HistoryPoint, AlertSeverity, BMSAlert } from '../types';

const generateMockData = (prevData: BMSData | null): BMSData => {
  const now = Date.now();
  
  // Simulate data fluctuation with more volatility for visibility
  let voltage = prevData ? prevData.voltage + (Math.random() - 0.5) * 1.5 : 400;
  let current = prevData ? prevData.current + (Math.random() - 0.5) * 4 : 15;
  let temp = prevData ? prevData.packTemp + (Math.random() - 0.5) * 0.8 : 35;
  let ambientTemp = prevData ? prevData.ambientTemp + (Math.random() - 0.5) * 0.4 : 24;
  
  // Boundaries
  voltage = Math.max(350, Math.min(450, voltage));
  temp = Math.max(20, Math.min(80, temp));
  ambientTemp = Math.max(10, Math.min(45, ambientTemp));

  // Performance simulation
  const velocity = prevData ? Math.max(0, Math.min(180, prevData.velocity + (Math.random() - 0.45) * 8)) : 65;
  const throttle = Math.max(0, Math.min(100, (velocity / 180) * 100 + (Math.random() - 0.5) * 15));
  const elevation = prevData ? prevData.elevation + (Math.random() - 0.5) * 5 : 450;
  const motorTorque = Math.max(0, Math.min(500, (throttle * 5) + (Math.random() - 0.5) * 30));
  const longitudinalAccel = (Math.random() - 0.3) * 6;

  const airconPower = 450 + (Math.random() * 150);
  const heatExchangerTemp = 28 + (Math.random() * 8);
  const coolantHeatercoreTemp = 55 + (Math.random() * 10);
  const coolantInletTemp = 32 + (Math.random() * 8);

  const swellRandom = Math.random();
  const leakRandom = Math.random();
  
  const isCharging = velocity === 0;
  // Increase SOC drop/gain rate for demo visibility
  const socStep = isCharging ? 0.2 : -0.15;
  const soc = prevData ? Math.max(0, Math.min(100, prevData.soc + socStep)) : 78;
  const remainingRangeKm = soc * 3.5;

  return {
    soc: parseFloat(soc.toFixed(1)),
    soh: 92.5,
    voltage: parseFloat(voltage.toFixed(1)),
    current: parseFloat(current.toFixed(1)),
    power: parseFloat((voltage * current).toFixed(0)),
    
    velocity: parseFloat(velocity.toFixed(1)),
    throttle: parseFloat(throttle.toFixed(0)),
    elevation: parseFloat(elevation.toFixed(0)),
    motorTorque: parseFloat(motorTorque.toFixed(1)),
    longitudinalAccel: parseFloat(longitudinalAccel.toFixed(2)),

    rulCycles: 1450,
    rulDays: 980,
    remainingRangeKm: parseFloat(remainingRangeKm.toFixed(1)),
    remainingTimeMinutes: parseFloat((remainingRangeKm / 60 * 60).toFixed(0)),
    
    packTemp: parseFloat(temp.toFixed(1)),
    ambientTemp: parseFloat(ambientTemp.toFixed(1)),
    humidity: 45 + (Math.random() * 5),
    pressure: 1013 + (Math.random() * 10),

    airconPower: parseFloat(airconPower.toFixed(1)),
    heatExchangerTemp: parseFloat(heatExchangerTemp.toFixed(1)),
    coolantHeatercoreTemp: parseFloat(coolantHeatercoreTemp.toFixed(1)),
    coolantInletTemp: parseFloat(coolantInletTemp.toFixed(1)),
    
    fanStatus: temp > 40,
    relayStatus: voltage > 440 || temp > 70 ? 'DISCONNECTED' : 'CONNECTED',
    isCharging: isCharging,
    
    capacityFadeDetected: false,
    thermalRunawayRisk: temp > 65,
    voltageAnomaly: voltage > 445,
    batterySwellDetected: swellRandom > 0.995,
    waterLeakageDetected: leakRandom > 0.995,
    
    timestamp: now
  };
};

export const useBMSData = () => {
  const [data, setData] = useState<BMSData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [alerts, setAlerts] = useState<BMSAlert[]>([]);

  useEffect(() => {
    const initialData = generateMockData(null);
    setData(initialData);

    const interval = setInterval(() => {
      setData((prev) => {
        const newData = generateMockData(prev);
        
        setHistory((prevHistory) => {
          const newPoint: HistoryPoint = {
            time: new Date(newData.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }),
            voltage: newData.voltage,
            temp: newData.packTemp,
            ambientTemp: newData.ambientTemp,
            current: newData.current,
            soc: newData.soc,
            range: newData.remainingRangeKm
          };
          const updated = [...prevHistory, newPoint];
          if (updated.length > 20) updated.shift();
          return updated;
        });

        const newAlerts: BMSAlert[] = [];
        const timestamp = Date.now();

        if (newData.waterLeakageDetected) {
          newAlerts.push({ id: `leak-${timestamp}`, code: 'HUM-01', message: 'CRITICAL: Water Leakage Detected!', severity: AlertSeverity.CRITICAL, timestamp });
        }
        if (newData.batterySwellDetected) {
          newAlerts.push({ id: `swell-${timestamp}`, code: 'PRS-01', message: 'CRITICAL: Cell Swelling Detected!', severity: AlertSeverity.CRITICAL, timestamp });
        }
        if (newData.thermalRunawayRisk) {
          newAlerts.push({ id: `therm-${timestamp}`, code: 'THM-01', message: 'Warning: Thermal Limit Approached', severity: AlertSeverity.WARNING, timestamp });
        }
        
        if (newAlerts.length > 0) {
            setAlerts(prev => [...newAlerts, ...prev].slice(0, 10));
        }

        return newData;
      });
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  return { data, history, alerts };
};