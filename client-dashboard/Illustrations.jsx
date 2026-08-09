import React from "react";

// Small set of original, flat-geometric-style SVG illustrations — abstract
// coin/chart/vault shapes built from circles, arcs and bars, not photos or
// borrowed artwork. Used on the landing page hero and a couple of dashboard
// empty states for visual interest without any copyright/licensing risk.

export function CoinStackIllustration({ size = 180 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <ellipse cx="100" cy="150" rx="70" ry="14" fill="#0F9D63" opacity="0.08" />
      <g>
        <ellipse cx="80" cy="130" rx="46" ry="14" fill="#F7931A" opacity="0.9" />
        <rect x="34" y="112" width="92" height="18" fill="#F7931A" opacity="0.9" />
        <ellipse cx="80" cy="112" rx="46" ry="14" fill="#FFB454" />
      </g>
      <g>
        <ellipse cx="120" cy="100" rx="46" ry="14" fill="#0F9D63" opacity="0.9" />
        <rect x="74" y="82" width="92" height="18" fill="#0F9D63" opacity="0.9" />
        <ellipse cx="120" cy="82" rx="46" ry="14" fill="#3FAE7E" />
        <text x="120" y="90" textAnchor="middle" fontSize="26" fontWeight="800" fill="#FFFFFF" fontFamily="Inter, sans-serif">
          ₿
        </text>
      </g>
      <g>
        <ellipse cx="80" cy="66" rx="46" ry="14" fill="#8C8CFF" opacity="0.9" />
        <rect x="34" y="48" width="92" height="18" fill="#8C8CFF" opacity="0.9" />
        <ellipse cx="80" cy="48" rx="46" ry="14" fill="#A9A9FF" />
      </g>
    </svg>
  );
}

export function ChartRiseIllustration({ size = 180 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="90" fill="#0F9D63" opacity="0.06" />
      <rect x="40" y="120" width="20" height="45" rx="4" fill="#E7F7EF" />
      <rect x="70" y="95" width="20" height="70" rx="4" fill="#B9E8D2" />
      <rect x="100" y="70" width="20" height="95" rx="4" fill="#4FC28A" />
      <rect x="130" y="45" width="20" height="120" rx="4" fill="#0F9D63" />
      <path
        d="M40 130 L80 100 L110 80 L150 40"
        stroke="#0F9D63"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <circle cx="150" cy="40" r="7" fill="#0F9D63" />
    </svg>
  );
}

export function VaultIllustration({ size = 180 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="88" fill="#B8790F" opacity="0.06" />
      <rect x="45" y="55" width="110" height="110" rx="16" fill="#FBF1E1" stroke="#B8790F" strokeWidth="3" />
      <circle cx="100" cy="110" r="28" fill="#FFFFFF" stroke="#B8790F" strokeWidth="3" />
      <circle cx="100" cy="110" r="6" fill="#B8790F" />
      <rect x="96" y="110" width="14" height="4" fill="#B8790F" />
      <rect x="60" y="70" width="16" height="6" rx="3" fill="#B8790F" opacity="0.5" />
      <rect x="124" y="70" width="16" height="6" rx="3" fill="#B8790F" opacity="0.5" />
    </svg>
  );
}

export function EmptyBoxIllustration({ size = 140 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <circle cx="100" cy="100" r="85" fill="#68766F" opacity="0.06" />
      <path d="M55 90 L100 65 L145 90 L145 145 L55 145 Z" fill="#E4E9E6" stroke="#68766F" strokeWidth="2" />
      <path d="M55 90 L100 115 L145 90" stroke="#68766F" strokeWidth="2" fill="none" />
      <path d="M100 65 L100 115" stroke="#68766F" strokeWidth="2" />
    </svg>
  );
}
