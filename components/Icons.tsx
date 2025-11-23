import React from 'react';

export const HeartIcon = ({ className, filled = true }: { className?: string, filled?: boolean }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill={filled ? "currentColor" : "none"} 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  </svg>
);

export const SkullIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <circle cx="9" cy="12" r="1" />
    <circle cx="15" cy="12" r="1" />
    <path d="M8 20v2h8v-2" />
    <path d="m12.5 17-.5-1-.5 1h1z" />
    <path d="M16 20a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20" />
  </svg>
);

export const UserPlusIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" x2="19" y1="8" y2="14" />
    <line x1="22" x2="16" y1="11" y2="11" />
  </svg>
);

export const CrownIcon = ({ className }: { className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14" />
  </svg>
);

export const D6Icon = ({ value, className }: { value: number | null, className?: string }) => {
    const baseClass = `border-2 border-current rounded-lg flex items-center justify-center ${className}`;
    if (!value) return (
        <div className={baseClass}>
            <span className="text-xs opacity-50">?</span>
        </div>
    );
    
    // Simple representations for dots
    return (
        <div className={`${baseClass} relative`}>
            {value === 1 && <div className="w-2 h-2 bg-current rounded-full" />}
            {value === 2 && (
                <>
                    <div className="absolute top-2 left-2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute bottom-2 right-2 w-1.5 h-1.5 bg-current rounded-full" />
                </>
            )}
            {value === 3 && (
                <>
                    <div className="absolute top-2 left-2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute bottom-2 right-2 w-1.5 h-1.5 bg-current rounded-full" />
                </>
            )}
            {value === 4 && (
                <>
                    <div className="absolute top-2 left-2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute bottom-2 left-2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute bottom-2 right-2 w-1.5 h-1.5 bg-current rounded-full" />
                </>
            )}
            {value === 5 && (
                <>
                    <div className="absolute top-2 left-2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute bottom-2 left-2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute bottom-2 right-2 w-1.5 h-1.5 bg-current rounded-full" />
                </>
            )}
            {value === 6 && (
                <>
                    <div className="absolute top-2 left-2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute top-2 right-2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute top-1/2 left-2 transform -translate-y-1/2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute top-1/2 right-2 transform -translate-y-1/2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute bottom-2 left-2 w-1.5 h-1.5 bg-current rounded-full" />
                    <div className="absolute bottom-2 right-2 w-1.5 h-1.5 bg-current rounded-full" />
                </>
            )}
        </div>
    )
}
