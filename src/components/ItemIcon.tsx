import React from 'react';
import { Package } from 'lucide-react';

interface ItemIconProps {
  name: string;
  category: string;
  className?: string;
}

export const ItemIcon: React.FC<ItemIconProps> = ({ name, category, className = "" }) => {
  // Determine colors and patterns based on name/category
  const isValkyrie = name.toLowerCase().includes('valkyrie');
  const isDominus = name.toLowerCase().includes('dominus');
  const isFace = category === 'Face';
  const isAnimation = category === 'Animation';
  const isLimitedU = name.toLowerCase().includes('rex') || name.toLowerCase().includes('void') || name.toLowerCase().includes('firebrand');
  
  const getGradient = () => {
    if (isDominus) return 'from-slate-400 via-slate-600 to-slate-800';
    if (isLimitedU) return 'from-red-400 via-red-600 to-red-800';
    if (isAnimation) return 'from-purple-400 via-purple-600 to-purple-800';
    if (name.toLowerCase().includes('golden')) return 'from-yellow-200 via-yellow-400 to-yellow-600';
    if (name.toLowerCase().includes('red')) return 'from-red-300 via-red-500 to-red-700';
    return 'from-brand-neon/20 to-brand-neon/40';
  };

  return (
    <div className={`relative w-full h-full flex items-center justify-center overflow-hidden bg-gray-50 ${className}`}>
      {/* Background Glow */}
      <div className={`absolute inset-0 bg-gradient-to-br ${getGradient()} opacity-10 blur-xl animate-pulse`} />
      
      {/* Abstract Shape */}
      <div className="relative z-10 w-full h-full flex items-center justify-center p-2">
        {isFace ? (
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <circle cx="50" cy="50" r="45" fill="none" stroke="#ddd" strokeWidth="1" />
            <g className="text-brand-text">
              <circle cx="35" cy="40" r="4" fill="currentColor" />
              <circle cx="65" cy="40" r="4" fill="currentColor" />
              <path d="M30 65 Q50 80 70 65" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </g>
          </svg>
        ) : isDominus ? (
          <svg viewBox="0 0 100 100" className="w-full h-full text-brand-text">
            <path d="M20 80 L50 20 L80 80 Z" fill="#222" stroke="currentColor" strokeWidth="1" />
            <circle cx="50" cy="55" r="12" fill="#111" />
            <path d="M35 45 L65 45" stroke="#D83133" strokeWidth="2" />
          </svg>
        ) : isValkyrie ? (
          <svg viewBox="0 0 100 100" className="w-full h-full text-brand-neon">
            <path d="M50 10 L80 50 L50 90 L20 50 Z" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M10 40 Q30 30 20 60" fill="none" stroke="#D83133" strokeWidth="3" />
            <path d="M90 40 Q70 30 80 60" fill="none" stroke="#D83133" strokeWidth="3" />
          </svg>
        ) : isAnimation ? (
          <svg viewBox="0 0 100 100" className="w-full h-full text-purple-600">
             <path d="M50 20 L30 50 L50 80 L70 50 Z" fill="none" stroke="currentColor" strokeWidth="2" />
             <circle cx="50" cy="50" r="10" fill="currentColor" className="animate-ping opacity-20" />
             <path d="M20 50 L10 50 M90 50 L80 50 M50 10 L50 5 M50 90 L50 95" stroke="currentColor" strokeWidth="2" />
          </svg>
        ) : (
          <svg viewBox="0 0 100 100" className="w-full h-full text-gray-300">
            <rect x="30" y="30" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1" />
            <Package size={24} className="text-gray-200" />
          </svg>
        )}
      </div>
    </div>
  );
};
