import React from "react";

export default function Logo({ className, style }: { className?: string, style?: React.CSSProperties }) {
  return (
    <svg 
      className={className} 
      style={style}
      viewBox="0 0 100 100" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="stmPurple" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#c026d3" />
          <stop offset="100%" stopColor="#7e22ce" />
        </linearGradient>
        <linearGradient id="stmOrange" x1="100%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="100%" stopColor="#f97316" />
        </linearGradient>
        <clipPath id="bottomHalf">
          <rect x="0" y="50" width="100" height="50" />
        </clipPath>
        <clipPath id="topHalf">
          <rect x="0" y="0" width="100" height="50" />
        </clipPath>
      </defs>

      {/* Outer Ring */}
      <circle cx="50" cy="50" r="46" stroke="url(#stmPurple)" strokeWidth="6" clipPath="url(#topHalf)" />
      <circle cx="50" cy="50" r="46" stroke="url(#stmOrange)" strokeWidth="6" clipPath="url(#bottomHalf)" />

      {/* Dynamic S */}
      <text 
        x="50" 
        y="80" 
        fontFamily="system-ui, -apple-system, sans-serif" 
        fontSize="82" 
        fontWeight="900" 
        fontStyle="italic"
        textAnchor="middle" 
        fill="url(#stmPurple)"
        clipPath="url(#topHalf)"
      >
        S
      </text>
      <text 
        x="50" 
        y="80" 
        fontFamily="system-ui, -apple-system, sans-serif" 
        fontSize="82" 
        fontWeight="900" 
        fontStyle="italic"
        textAnchor="middle" 
        fill="url(#stmOrange)"
        clipPath="url(#bottomHalf)"
      >
        S
      </text>
    </svg>
  );
}
