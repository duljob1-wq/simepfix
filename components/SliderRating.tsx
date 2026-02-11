
import React from 'react';

interface SliderRatingProps {
  value: number;
  onChange: (val: number) => void;
  readonly?: boolean;
}

const getLabel = (val: number) => {
  if (val <= 55) return 'Kurang';
  if (val <= 75) return 'Sedang';
  if (val <= 85) return 'Baik';
  return 'Sangat Baik';
};

const getColorClass = (val: number) => {
    if (val <= 55) return 'bg-red-500';
    if (val <= 75) return 'bg-orange-500';
    if (val <= 85) return 'bg-blue-500';
    return 'bg-emerald-500';
}

export const SliderRating: React.FC<SliderRatingProps> = ({ value, onChange, readonly = false }) => {
  const min = 45;
  const max = 100;
  const range = max - min;
  const displayValue = value < min ? min : value;
  const percent = ((displayValue - min) / range) * 100;

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const newVal = Number(e.target.value);
      onChange(Math.max(min, newVal));
  };

  return (
    <div className="w-full pt-1 px-1 pb-2">
      {/* Header Value & Badge - Margin reduced from mb-6 to mb-2, text-4xl to text-3xl */}
      <div className="flex justify-between items-end mb-2">
        <div className="text-3xl font-bold transition-colors text-slate-800 leading-none">
            {displayValue}
        </div>
        <div className={`px-2.5 py-0.5 rounded-full text-[10px] text-white font-bold uppercase tracking-wide shadow-sm transition-colors duration-300 ${getColorClass(displayValue)}`}>
          {getLabel(displayValue)}
        </div>
      </div>
      
      {/* Combined Slider Track Area - h-12 to h-10 */}
      <div className="relative w-full h-10 flex flex-col justify-center group select-none">
          
          {/* 1. Track Background */}
          <div className="absolute w-full h-2.5 rounded-full overflow-hidden flex">
             <div className="h-full bg-red-100" style={{ width: '18.18%' }}></div>
             <div className="h-full bg-orange-100" style={{ width: '36.36%' }}></div>
             <div className="h-full bg-blue-100" style={{ width: '18.18%' }}></div>
             <div className="h-full bg-emerald-100" style={{ width: '27.28%' }}></div>
             
             {/* Tick Marks */}
             <div className="absolute top-0 bottom-0 w-[2px] bg-white z-0" style={{ left: '18.18%' }}></div>
             <div className="absolute top-0 bottom-0 w-[2px] bg-white z-0" style={{ left: '54.54%' }}></div>
             <div className="absolute top-0 bottom-0 w-[2px] bg-white z-0" style={{ left: '72.72%' }}></div>
          </div>

          {/* 2. Active Fill */}
          <div className="absolute top-1/2 -translate-y-1/2 h-2.5 left-0 rounded-full overflow-hidden pointer-events-none z-0" style={{ width: `${percent}%` }}>
               <div className={`h-full transition-all duration-150 ease-out ${getColorClass(displayValue)}`} />
          </div>
          
          {/* 3. Native Input */}
          <input
            type="range"
            min={min}
            max={max}
            step="1"
            value={displayValue}
            disabled={readonly}
            onChange={handleSliderChange}
            className="absolute w-full h-full opacity-0 cursor-pointer z-20"
          />

          {/* 4. Custom Thumb Visual - Adjusted position calculation */}
          <div 
             className="absolute top-1/2 -translate-y-1/2 w-6 h-6 bg-white border border-slate-200 rounded-full shadow-md pointer-events-none transition-all duration-150 ease-out flex items-center justify-center z-10"
             style={{ left: `calc(${percent}% - 12px)` }}
          >
             <div className={`w-2 h-2 rounded-full ${getColorClass(displayValue)}`}></div>
          </div>

          {/* 5. Integrated Labels & Ticks - Adjusted top from 8 to 6 */}
          <div className="absolute top-7 w-full h-6 pointer-events-none">
             {/* Numbers */}
             <span className="absolute -translate-x-0 text-[9px] font-bold text-slate-800" style={{ left: '0%' }}>45</span>
             <span className="absolute -translate-x-1/2 text-[9px] font-bold text-slate-300" style={{ left: '18.18%' }}>55</span>
             <span className="absolute -translate-x-1/2 text-[9px] font-bold text-slate-300" style={{ left: '54.54%' }}>75</span>
             <span className="absolute -translate-x-1/2 text-[9px] font-bold text-slate-300" style={{ left: '72.72%' }}>85</span>
             <span className="absolute translate-x-0 right-0 text-[9px] font-bold text-slate-300">100</span>

             {/* Zone Text Labels */}
             <span className={`absolute -translate-x-1/2 text-[8px] font-extrabold uppercase tracking-tight transition-colors ${displayValue <= 55 ? 'text-red-500 opacity-100' : 'text-slate-300 opacity-60'}`} style={{ left: '9.09%' }}>Kurang</span>
             <span className={`absolute -translate-x-1/2 text-[8px] font-extrabold uppercase tracking-tight transition-colors ${displayValue > 55 && displayValue <= 75 ? 'text-orange-500 opacity-100' : 'text-slate-300 opacity-60'}`} style={{ left: '36.36%' }}>Sedang</span>
             <span className={`absolute -translate-x-1/2 text-[8px] font-extrabold uppercase tracking-tight transition-colors ${displayValue > 75 && displayValue <= 85 ? 'text-blue-500 opacity-100' : 'text-slate-300 opacity-60'}`} style={{ left: '63.63%' }}>Baik</span>
             <span className={`absolute -translate-x-1/2 text-[8px] font-extrabold uppercase tracking-tight transition-colors ${displayValue > 85 ? 'text-emerald-500 opacity-100' : 'text-slate-300 opacity-60'}`} style={{ left: '86.36%' }}>Sgt Baik</span>
          </div>
      </div>
    </div>
  );
};
