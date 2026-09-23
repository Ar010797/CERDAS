import React from 'react';

/**
 * High-fidelity vector illustrations matching the school schedule poster theme
 */

// Vintage scroll flourish divider line above and below the main title
export function FlourishDivider({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-slate-700 opacity-80 ${className}`}>
      <svg width="220" height="24" viewBox="0 0 220 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="max-w-full">
        {/* Left flourish scroll */}
        <path
          d="M10 12 C25 12 35 4 45 4 C55 4 60 16 75 16 C85 16 95 12 105 12"
          stroke="#475569"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="12" cy="12" r="2.5" fill="#475569" />
        <path d="M45 4 C42 8 38 10 32 10" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M75 16 C78 12 82 10 88 10" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
        
        {/* Center floral diamond emblem */}
        <g transform="translate(110, 12)">
          <path d="M0 -6 L4 0 L0 6 L-4 0 Z" fill="#475569" />
          <circle cx="-9" cy="0" r="1.5" fill="#475569" />
          <circle cx="9" cy="0" r="1.5" fill="#475569" />
          <circle cx="0" cy="0" r="1.5" fill="#ffffff" />
        </g>

        {/* Right flourish scroll */}
        <path
          d="M210 12 C195 12 185 4 175 4 C165 4 160 16 145 16 C135 16 125 12 115 12"
          stroke="#475569"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="208" cy="12" r="2.5" fill="#475569" />
        <path d="M175 4 C178 8 182 10 188 10" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M145 16 C142 12 138 10 132 10" stroke="#475569" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// Top Left: Stack of colorful textbooks + Rocket Book + Atom doodle + Stars
export function TopLeftRocketBooks() {
  return (
    <div className="relative w-28 h-28 sm:w-36 sm:h-36 pointer-events-none select-none">
      {/* Atom symbol */}
      <svg className="absolute -top-1 right-2 w-8 h-8 opacity-75 text-sky-600 animate-spin-slow" viewBox="0 0 40 40" fill="none">
        <ellipse cx="20" cy="20" rx="18" ry="6" stroke="#0284c7" strokeWidth="1.2" transform="rotate(30 20 20)" />
        <ellipse cx="20" cy="20" rx="18" ry="6" stroke="#0284c7" strokeWidth="1.2" transform="rotate(-30 20 20)" />
        <ellipse cx="20" cy="20" rx="18" ry="6" stroke="#0284c7" strokeWidth="1.2" transform="rotate(90 20 20)" />
        <circle cx="20" cy="20" r="3" fill="#0284c7" />
      </svg>

      {/* Yellow Star */}
      <div className="absolute top-6 -right-1 text-amber-400 text-base filter drop-shadow-xs">⭐</div>

      {/* Main Books Stack */}
      <svg viewBox="0 0 140 140" className="w-full h-full drop-shadow-md">
        {/* Book 1 (Teal Green, vertical) */}
        <rect x="12" y="22" width="16" height="95" rx="3" fill="#14b8a6" stroke="#0f172a" strokeWidth="2.5" />
        <rect x="15" y="30" width="10" height="2" fill="#ccfbf1" />
        <rect x="15" y="100" width="10" height="2" fill="#ccfbf1" />

        {/* Book 2 (Bright Orange, vertical) */}
        <rect x="28" y="18" width="18" height="99" rx="3" fill="#f97316" stroke="#0f172a" strokeWidth="2.5" />
        <rect x="32" y="28" width="10" height="2" fill="#ffedd5" />
        <rect x="32" y="102" width="10" height="2" fill="#ffedd5" />
        <circle cx="37" cy="40" r="3" fill="#fef08a" />

        {/* Book 3 (Bright Yellow, vertical) */}
        <rect x="46" y="24" width="16" height="93" rx="3" fill="#facc15" stroke="#0f172a" strokeWidth="2.5" />
        <rect x="49" y="32" width="10" height="2" fill="#fef9c3" />
        <rect x="49" y="98" width="10" height="2" fill="#fef9c3" />

        {/* Book 4 (Dark Blue ROCKET Book, leaning with Rocket sticker) */}
        <g transform="rotate(8 75 60)">
          <rect x="62" y="14" width="56" height="98" rx="5" fill="#1e3a8a" stroke="#0f172a" strokeWidth="2.5" />
          <rect x="65" y="18" width="50" height="90" rx="3" fill="#2563eb" />
          
          {/* Label "ROCKET" */}
          <rect x="70" y="24" width="40" height="13" rx="2" fill="#ffffff" stroke="#0f172a" strokeWidth="1.2" />
          <text x="90" y="34" fontSize="8" fontWeight="900" textAnchor="middle" fill="#1e3a8a" fontFamily="sans-serif">
            ROCKET
          </text>

          {/* Rocket sticker */}
          <g transform="translate(80, 48)">
            {/* Flames */}
            <path d="M10 28 Q12 36 10 40 Q8 36 10 28" fill="#ef4444" />
            <path d="M10 28 Q11 34 10 37 Q9 34 10 28" fill="#f59e0b" />
            {/* Body */}
            <path d="M10 4 Q18 10 18 24 L2 24 Q2 10 10 4 Z" fill="#ffffff" stroke="#0f172a" strokeWidth="1.5" />
            {/* Fins */}
            <path d="M2 20 L-3 26 L2 25 Z" fill="#ef4444" stroke="#0f172a" strokeWidth="1" />
            <path d="M18 20 L23 26 L18 25 Z" fill="#ef4444" stroke="#0f172a" strokeWidth="1" />
            {/* Window */}
            <circle cx="10" cy="14" r="3.5" fill="#38bdf8" stroke="#0f172a" strokeWidth="1" />
            {/* Rocket Tip */}
            <path d="M10 4 Q14 8 14 11 L6 11 Q6 8 10 4 Z" fill="#ef4444" />
          </g>

          {/* Little Stars */}
          <circle cx="73" cy="50" r="1.5" fill="#fef08a" />
          <circle cx="107" cy="65" r="1.5" fill="#fef08a" />
          <circle cx="75" cy="85" r="1.5" fill="#fef08a" />
        </g>
      </svg>
    </div>
  );
}

// Top Right: School Bell on Stand + Glass Cup with Pens and Pencils
export function TopRightBellAndPens() {
  return (
    <div className="relative w-32 h-32 sm:w-40 sm:h-40 pointer-events-none select-none">
      {/* Decorative pastel sparkles & note doodle */}
      <div className="absolute top-2 left-0 text-rose-400 text-sm">✨</div>
      <div className="absolute top-8 left-4 w-4 h-4 bg-amber-200/70 rounded-full blur-xs" />
      <div className="absolute top-1 right-2 text-sky-400 text-xs">⭐</div>

      <svg viewBox="0 0 160 160" className="w-full h-full drop-shadow-md">
        {/* School Desk Bell (Golden bell, red ring, blue stand) */}
        <g transform="translate(10, 15)">
          {/* Bell Top Button */}
          <ellipse cx="38" cy="16" rx="4" ry="2" fill="#ca8a04" stroke="#0f172a" strokeWidth="1.5" />
          <rect x="36" y="18" width="4" height="6" fill="#ca8a04" stroke="#0f172a" strokeWidth="1.5" />
          
          {/* Yellow Bell Dome */}
          <path
            d="M38 24 C20 24 16 38 14 54 C13 60 10 64 8 66 L68 66 C66 64 63 60 62 54 C60 38 56 24 38 24 Z"
            fill="#facc15"
            stroke="#0f172a"
            strokeWidth="2.5"
          />
          {/* Bell highlight reflection */}
          <path d="M26 34 C22 42 20 50 18 58" stroke="#fef9c3" strokeWidth="2.5" strokeLinecap="round" />
          <circle cx="38" cy="38" r="5" fill="#ffffff" opacity="0.6" />

          {/* Red Base Ring */}
          <rect x="6" y="66" width="64" height="8" rx="2" fill="#ef4444" stroke="#0f172a" strokeWidth="2" />

          {/* Teal Base Stand */}
          <path d="M12 74 L64 74 L68 84 L8 84 Z" fill="#0d9488" stroke="#0f172a" strokeWidth="2.5" />
          <rect x="18" y="77" width="40" height="3" rx="1.5" fill="#5eead4" />
        </g>

        {/* Cup with Pens and Pencils */}
        <g transform="translate(90, 30)">
          {/* Pens sticking out */}
          {/* Pen 1 (Pink ballpoint) */}
          <g transform="rotate(-15 25 40)">
            <rect x="22" y="-12" width="6" height="52" rx="2" fill="#ec4899" stroke="#0f172a" strokeWidth="1.5" />
            <path d="M22 40 L25 48 L28 40 Z" fill="#0f172a" />
            <rect x="20" y="-10" width="2" height="18" rx="1" fill="#0f172a" />
            <rect x="23" y="-10" width="4" height="4" fill="#fbcfe8" />
          </g>

          {/* Pen 2 (Yellow Pencil) */}
          <g transform="rotate(6 35 40)">
            <rect x="32" y="-16" width="6" height="56" rx="1" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.5" />
            <polygon points="32,-16 35,-24 38,-16" fill="#fde68a" stroke="#0f172a" strokeWidth="1.2" />
            <polygon points="33,-20 35,-24 37,-20" fill="#0f172a" />
            <rect x="32" y="34" width="6" height="6" fill="#f43f5e" stroke="#0f172a" strokeWidth="1.2" />
          </g>

          {/* Pen 3 (Turquoise Pen) */}
          <g transform="rotate(18 42 40)">
            <rect x="40" y="-8" width="6" height="50" rx="2" fill="#06b6d4" stroke="#0f172a" strokeWidth="1.5" />
            <rect x="44" y="-6" width="2" height="16" rx="1" fill="#0f172a" />
          </g>

          {/* Pen 4 (Purple Pen) */}
          <g transform="rotate(28 48 40)">
            <rect x="46" y="-14" width="6" height="54" rx="2" fill="#8b5cf6" stroke="#0f172a" strokeWidth="1.5" />
            <path d="M46 -14 L49 -20 L52 -14 Z" fill="#c4b5fd" stroke="#0f172a" strokeWidth="1" />
          </g>

          {/* Glass / Plastic Cup */}
          <path
            d="M15 30 L22 84 C23 88 28 92 35 92 L50 92 C57 92 62 88 63 84 L70 30 Z"
            fill="#e0e7ff"
            fillOpacity="0.85"
            stroke="#1e293b"
            strokeWidth="2.5"
          />
          {/* Glass reflection highlight */}
          <path d="M22 36 L27 80" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
          <ellipse cx="42.5" cy="30" rx="27.5" ry="6" fill="#c7d2fe" stroke="#1e293b" strokeWidth="2" />
        </g>
      </svg>
    </div>
  );
}

// Bottom Left: Dinosaur Book + Paint Album + Books Stack + Dangling School Bell
export function BottomLeftDinoAndPaint() {
  return (
    <div className="relative w-36 h-36 sm:w-44 sm:h-44 pointer-events-none select-none">
      <svg viewBox="0 0 170 170" className="w-full h-full drop-shadow-md">
        {/* Book 1 (Bottom Blue horizontal book) */}
        <rect x="10" y="125" width="85" height="14" rx="2" fill="#3b82f6" stroke="#0f172a" strokeWidth="2" />
        <rect x="14" y="127" width="77" height="3" fill="#93c5fd" />

        {/* Book 2 (Pink/Red horizontal book) */}
        <rect x="12" y="112" width="80" height="13" rx="2" fill="#ef4444" stroke="#0f172a" strokeWidth="2" />
        <rect x="16" y="114" width="72" height="3" fill="#fca5a5" />

        {/* Book 3 (Yellow horizontal book) */}
        <rect x="15" y="99" width="75" height="13" rx="2" fill="#eab308" stroke="#0f172a" strokeWidth="2" />
        <rect x="18" y="101" width="68" height="3" fill="#fef08a" />

        {/* Green DINOSAUR Book (leaning upright on the left) */}
        <g transform="rotate(-12 35 70)">
          <rect x="10" y="15" width="48" height="74" rx="4" fill="#22c55e" stroke="#0f172a" strokeWidth="2.5" />
          <rect x="13" y="18" width="42" height="68" rx="2" fill="#86efac" />
          
          {/* Label "DINOSAUR" */}
          <rect x="16" y="22" width="36" height="10" rx="2" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
          <text x="34" y="30" fontSize="6.5" fontWeight="900" textAnchor="middle" fill="#15803d" fontFamily="sans-serif">
            DINOSAUR
          </text>

          {/* Cute Dinosaur sticker */}
          <g transform="translate(22, 36)">
            {/* Body */}
            <path
              d="M12 24 C6 24 2 20 2 14 C2 8 8 4 14 4 C18 4 22 7 24 11 C26 15 24 22 20 23 L22 27 L18 25 L16 27 Z"
              fill="#16a34a"
              stroke="#0f172a"
              strokeWidth="1.2"
            />
            {/* Eye */}
            <circle cx="16" cy="8" r="2" fill="#ffffff" />
            <circle cx="16.5" cy="8" r="1" fill="#0f172a" />
            {/* Belly & spikes */}
            <circle cx="10" cy="15" r="4" fill="#bbf7d0" />
            <path d="M6 6 L8 4 L10 6" stroke="#0f172a" strokeWidth="1" />
            <path d="M10 4 L12 2 L14 4" stroke="#0f172a" strokeWidth="1" />
          </g>
        </g>

        {/* Purple PAINT Art Book with palette */}
        <g transform="translate(68, 65)">
          <rect x="0" y="8" width="58" height="70" rx="4" fill="#8b5cf6" stroke="#0f172a" strokeWidth="2.5" />
          <rect x="4" y="12" width="50" height="62" rx="2" fill="#c4b5fd" />
          
          {/* Label "PAINT" */}
          <rect x="10" y="16" width="38" height="12" rx="2" fill="#ffffff" stroke="#0f172a" strokeWidth="1" />
          <text x="29" y="25" fontSize="8" fontWeight="900" textAnchor="middle" fill="#6d28d9" fontFamily="sans-serif">
            PAINT
          </text>

          {/* Color Palette sticker */}
          <g transform="translate(12, 34)">
            <path
              d="M17 2 C9 2 3 7 3 15 C3 23 9 28 17 28 C22 28 27 25 29 20 C30 18 28 16 26 16 C23 16 22 14 24 11 C26 9 27 8 27 6 C27 4 23 2 17 2 Z"
              fill="#fed7aa"
              stroke="#0f172a"
              strokeWidth="1.2"
            />
            <circle cx="9" cy="11" r="2" fill="#ef4444" />
            <circle cx="14" cy="7" r="2" fill="#3b82f6" />
            <circle cx="21" cy="9" r="2" fill="#eab308" />
            <circle cx="11" cy="19" r="2" fill="#10b981" />
            {/* Thumb hole */}
            <circle cx="21" cy="22" r="2" fill="#c4b5fd" stroke="#0f172a" strokeWidth="0.8" />
          </g>
        </g>

        {/* Dangling School Hand Bell */}
        <g transform="translate(132, 10) rotate(15)">
          <path d="M6 0 C8 15 10 25 10 35 L4 35 L4 40 L16 40 L16 35 L10 35" fill="#6366f1" stroke="#0f172a" strokeWidth="1.5" />
          <path d="M2 40 C0 42 -2 55 -4 65 L24 65 C22 55 20 42 18 40 Z" fill="#eab308" stroke="#0f172a" strokeWidth="2" />
          <circle cx="10" cy="67" r="3.5" fill="#ca8a04" stroke="#0f172a" strokeWidth="1.2" />
          <rect x="-8" y="65" width="36" height="5" rx="2" fill="#f43f5e" stroke="#0f172a" strokeWidth="1.5" />
        </g>
      </svg>
    </div>
  );
}

// Bottom Center: Open Doodle Sketchbook with "IDEAS" Robot and "ART" Sun
export function BottomCenterSketchbook() {
  return (
    <div className="relative w-56 h-28 sm:w-72 sm:h-36 pointer-events-none select-none">
      <svg viewBox="0 0 280 140" className="w-full h-full drop-shadow-lg">
        {/* Book Covers (Backing) */}
        <path d="M12 18 L138 24 L138 128 L12 120 Z" fill="#334155" stroke="#0f172a" strokeWidth="2.5" />
        <path d="M268 18 L142 24 L142 128 L268 120 Z" fill="#334155" stroke="#0f172a" strokeWidth="2.5" />

        {/* Left Page (White paper) */}
        <path d="M16 20 C60 16 100 20 137 25 L137 124 C100 120 60 116 16 117 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />
        {/* Right Page (White paper) */}
        <path d="M264 20 C220 16 180 20 143 25 L143 124 C180 120 220 116 264 117 Z" fill="#ffffff" stroke="#94a3b8" strokeWidth="1.5" />

        {/* Center Spiral Rings */}
        {[30, 42, 54, 66, 78, 90, 102, 114].map((y, idx) => (
          <ellipse key={idx} cx="140" cy={y} rx="5" ry="3" fill="#e2e8f0" stroke="#0f172a" strokeWidth="1.5" />
        ))}

        {/* Left Page Content: "IDEAS" + Robot + Stickers */}
        <g transform="translate(25, 26)">
          {/* Word "IDEAS" colorful bubble letters */}
          <text x="52" y="16" fontSize="13" fontWeight="900" fill="#0f172a" textAnchor="middle" letterSpacing="1.5" fontFamily="'Fredoka', sans-serif">
            IDEAS
          </text>
          <path d="M22 20 Q52 24 82 20" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />

          {/* Cute Robot Doodle Left */}
          <g transform="translate(18, 28)">
            {/* Antenna */}
            <line x1="12" y1="0" x2="12" y2="4" stroke="#0f172a" strokeWidth="1.5" />
            <circle cx="12" cy="0" r="2" fill="#facc15" stroke="#0f172a" strokeWidth="1" />
            {/* Head */}
            <rect x="4" y="4" width="16" height="12" rx="2" fill="#38bdf8" stroke="#0f172a" strokeWidth="1.2" />
            <circle cx="9" cy="9" r="1.5" fill="#ffffff" />
            <circle cx="15" cy="9" r="1.5" fill="#ffffff" />
            {/* Body */}
            <rect x="2" y="18" width="20" height="18" rx="2" fill="#818cf8" stroke="#0f172a" strokeWidth="1.2" />
            <rect x="6" y="22" width="12" height="6" fill="#ffffff" />
            {/* Legs */}
            <rect x="5" y="36" width="4" height="6" fill="#38bdf8" stroke="#0f172a" strokeWidth="1" />
            <rect x="15" y="36" width="4" height="6" fill="#38bdf8" stroke="#0f172a" strokeWidth="1" />
          </g>

          {/* Monster / Character Right */}
          <g transform="translate(56, 30)">
            <ellipse cx="14" cy="18" rx="10" ry="14" fill="#ec4899" stroke="#0f172a" strokeWidth="1.2" />
            <circle cx="11" cy="14" r="2" fill="#ffffff" />
            <circle cx="17" cy="14" r="2" fill="#ffffff" />
            <path d="M10 22 Q14 26 18 22" stroke="#0f172a" strokeWidth="1" />
          </g>

          {/* Washi Tape strip */}
          <rect x="20" y="78" width="28" height="6" rx="1" fill="#fde047" transform="rotate(-4 34 81)" />
          <rect x="54" y="76" width="24" height="6" rx="1" fill="#4ade80" transform="rotate(3 66 79)" />
          {/* Little heart */}
          <text x="44" y="80" fontSize="10" fill="#ef4444">❤️</text>
        </g>

        {/* Right Page Content: "ART" + Smiling Sun + Doodles */}
        <g transform="translate(150, 26)">
          {/* Smiling Sun */}
          <g transform="translate(68, 14)">
            <circle cx="12" cy="12" r="10" fill="#facc15" stroke="#f59e0b" strokeWidth="1.5" />
            <circle cx="9" cy="10" r="1.2" fill="#0f172a" />
            <circle cx="15" cy="10" r="1.2" fill="#0f172a" />
            <path d="M9 14 Q12 17 15 14" stroke="#0f172a" strokeWidth="1" fill="none" />
            {/* Sun Rays */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
              <line
                key={deg}
                x1={12 + 13 * Math.cos((deg * Math.PI) / 180)}
                y1={12 + 13 * Math.sin((deg * Math.PI) / 180)}
                x2={12 + 16 * Math.cos((deg * Math.PI) / 180)}
                y2={12 + 16 * Math.sin((deg * Math.PI) / 180)}
                stroke="#f59e0b"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            ))}
          </g>

          {/* Word "ART" in bright colors */}
          <g transform="translate(14, 32)">
            <text x="0" y="16" fontSize="20" fontWeight="900" fill="#3b82f6" fontFamily="'Fredoka', sans-serif">A</text>
            <text x="16" y="16" fontSize="20" fontWeight="900" fill="#ef4444" fontFamily="'Fredoka', sans-serif">R</text>
            <text x="32" y="16" fontSize="20" fontWeight="900" fill="#eab308" fontFamily="'Fredoka', sans-serif">T</text>
          </g>

          {/* Doodles: Little Landscape & Flowers */}
          <path d="M12 66 Q30 54 50 68 Q70 56 94 68" stroke="#10b981" strokeWidth="1.5" fill="none" />
          <circle cx="28" cy="56" r="3" fill="#f43f5e" />
          <circle cx="68" cy="54" r="3" fill="#8b5cf6" />
          <rect x="30" y="74" width="40" height="4" rx="2" fill="#38bdf8" />
        </g>
      </svg>
    </div>
  );
}

// Bottom Right: Pocket Watch / Compass + School Globe + Tablet with Color Swatches + Brushes
export function BottomRightGlobeAndArt() {
  return (
    <div className="relative w-36 h-36 sm:w-44 sm:h-44 pointer-events-none select-none">
      <svg viewBox="0 0 170 170" className="w-full h-full drop-shadow-md">
        {/* Vintage Pocket Watch / Compass Left */}
        <g transform="translate(10, 80)">
          {/* Top Loop */}
          <circle cx="22" cy="6" r="5" fill="none" stroke="#ca8a04" strokeWidth="2.5" />
          {/* Watch Body */}
          <circle cx="22" cy="28" r="22" fill="#fef08a" stroke="#ca8a04" strokeWidth="3" />
          <circle cx="22" cy="28" r="18" fill="#ffffff" stroke="#eab308" strokeWidth="1.2" />
          {/* Compass Rose / Clock Hands */}
          <path d="M22 14 L24 28 L22 24 L20 28 Z" fill="#ef4444" />
          <path d="M22 42 L24 28 L22 32 L20 28 Z" fill="#334155" />
          <circle cx="22" cy="28" r="2" fill="#ca8a04" />
          {/* Roman Marks */}
          <line x1="22" y1="12" x2="22" y2="15" stroke="#475569" strokeWidth="1.5" />
          <line x1="22" y1="41" x2="22" y2="44" stroke="#475569" strokeWidth="1.5" />
          <line x1="6" y1="28" x2="9" y2="28" stroke="#475569" strokeWidth="1.5" />
          <line x1="35" y1="28" x2="38" y2="28" stroke="#475569" strokeWidth="1.5" />
        </g>

        {/* Desktop School Globe Right Center */}
        <g transform="translate(68, 62)">
          {/* Meridian Arc Brass */}
          <path d="M12 8 A32 32 0 1 0 54 50" fill="none" stroke="#d97706" strokeWidth="3.5" strokeLinecap="round" />
          {/* Globe Ball */}
          <circle cx="33" cy="29" r="24" fill="#38bdf8" stroke="#0f172a" strokeWidth="2.5" />
          {/* Continents (Yellow/Green) */}
          <path d="M24 16 Q32 18 36 24 Q32 30 22 28 Q18 22 24 16 Z" fill="#4ade80" />
          <path d="M38 28 Q48 32 46 42 Q38 46 34 38 Z" fill="#facc15" />
          <path d="M18 36 Q26 38 24 44 Q16 46 18 36 Z" fill="#4ade80" />
          {/* Lat/Long Lines */}
          <ellipse cx="33" cy="29" rx="14" ry="24" fill="none" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 2" />
          <line x1="9" y1="29" x2="57" y2="29" stroke="#0284c7" strokeWidth="1" strokeDasharray="3 2" />
          
          {/* Base Stand */}
          <path d="M33 54 L33 66" stroke="#d97706" strokeWidth="4" />
          <ellipse cx="33" cy="68" rx="16" ry="6" fill="#b45309" stroke="#0f172a" strokeWidth="2" />
          <ellipse cx="33" cy="66" rx="14" ry="4" fill="#d97706" />
        </g>

        {/* Art Tablet with 6-color geometric swatches (Top Right) */}
        <g transform="translate(85, 8) rotate(12)">
          <rect x="0" y="0" width="56" height="42" rx="4" fill="#1e293b" stroke="#0f172a" strokeWidth="2" />
          <rect x="3" y="3" width="50" height="36" rx="2" fill="#ffffff" />
          {/* 6 colorful swatches grid */}
          <polygon points="6,6 18,6 12,18" fill="#ef4444" />
          <polygon points="20,6 32,6 26,18" fill="#f59e0b" />
          <polygon points="34,6 46,6 40,18" fill="#10b981" />
          <polygon points="6,20 18,20 12,32" fill="#3b82f6" />
          <polygon points="20,20 32,20 26,32" fill="#8b5cf6" />
          <polygon points="34,20 46,20 40,32" fill="#ec4899" />
        </g>

        {/* Paint Brushes & Yellow Pencil leaning */}
        <g transform="translate(65, 20) rotate(-35)">
          {/* Pencil */}
          <rect x="0" y="0" width="4" height="48" rx="1" fill="#facc15" stroke="#0f172a" strokeWidth="1" />
          <polygon points="0,0 2,-6 4,0" fill="#fde68a" stroke="#0f172a" strokeWidth="0.8" />
          <polygon points="1,-3 2,-6 3,-3" fill="#0f172a" />
          {/* Brush 1 */}
          <rect x="8" y="-4" width="3" height="54" fill="#dc2626" stroke="#0f172a" strokeWidth="1" />
          <path d="M8 -4 Q9.5 -12 11 -4 Z" fill="#1e293b" />
          {/* Brush 2 */}
          <rect x="14" y="2" width="2.5" height="50" fill="#2563eb" stroke="#0f172a" strokeWidth="1" />
          <path d="M14 2 Q15.2 -6 16.5 2 Z" fill="#1e293b" />
        </g>
      </svg>
    </div>
  );
}
