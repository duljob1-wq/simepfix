
import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface StarRatingProps {
  value: number;
  onChange: (val: number) => void;
  readonly?: boolean;
}

const LABELS: Record<number, string> = {
  1: 'Kurang',
  2: 'Sedang',
  3: 'Cukup',
  4: 'Baik',
  5: 'Sangat Baik'
};

const COLORS: Record<number, string> = {
    1: 'text-red-500',
    2: 'text-orange-500',
    3: 'text-yellow-500',
    4: 'text-lime-500',
    5: 'text-green-600'
}

export const StarRating: React.FC<StarRatingProps> = ({ value, onChange, readonly = false }) => {
  const [hover, setHover] = useState(0);
  const currentVal = hover || value;

  return (
    <div className="flex flex-col items-center sm:items-start gap-1 w-full">
      <div className="flex items-center justify-between w-full max-w-xs gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            disabled={readonly}
            className={`transition-transform duration-200 p-0.5 ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110 active:scale-95'}`}
            onClick={() => onChange(star)}
            onMouseEnter={() => !readonly && setHover(star)}
            onMouseLeave={() => !readonly && setHover(0)}
          >
            <Star
              size={32}
              className={`transition-all duration-300 ${
                  (hover || value) >= star 
                  ? 'fill-amber-400 text-amber-400 drop-shadow-sm' 
                  : 'fill-slate-100 text-slate-300'
              }`}
            />
          </button>
        ))}
      </div>
      <div className={`text-xs font-semibold h-5 transition-all duration-300 ${COLORS[currentVal] || 'text-slate-400'}`}>
        {currentVal ? LABELS[currentVal] : 'Geser atau ketuk bintang'}
      </div>
    </div>
  );
};
