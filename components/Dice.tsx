import React, { useState, useEffect } from 'react';
import { D6Icon } from './Icons';

interface DiceProps {
  value: number | null;
  rolling: boolean;
  onRollComplete?: () => void;
}

const Dice: React.FC<DiceProps> = ({ value, rolling, onRollComplete }) => {
  const [displayValue, setDisplayValue] = useState<number>(1);
  
  useEffect(() => {
    if (rolling) {
      const interval = setInterval(() => {
        setDisplayValue(Math.floor(Math.random() * 6) + 1);
      }, 80);
      return () => clearInterval(interval);
    } else if (value) {
      setDisplayValue(value);
      if (onRollComplete) onRollComplete();
    }
  }, [rolling, value, onRollComplete]);

  return (
    <div className={`transition-transform duration-300 ${rolling ? 'animate-bounce' : 'scale-100'}`}>
       <div className="w-24 h-24 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl shadow-lg shadow-indigo-500/50 flex items-center justify-center border border-indigo-400/30">
          <D6Icon value={displayValue} className="w-16 h-16 text-white border-0" />
       </div>
    </div>
  );
};

export default Dice;
