import React, { useId } from 'react';
import Svg, {
  Circle, Path, Ellipse, Line, G, Defs, ClipPath,
} from 'react-native-svg';

export default function HalfPizza({ size = 120 }) {
  const uid = useId().replace(/\W/g, '');
  const cx = size / 2;
  const cy = size / 2;
  const s = size / 100;
  const R = size / 2;
  const crustW = 9 * s;
  const r = R - crustW;

  const lId = `hp_l${uid}`;
  const rId = `hp_r${uid}`;

  // Left semicircle (west half, CCW arc)
  const lArc = `M ${cx},${cy - r} A ${r},${r} 0 0,0 ${cx},${cy + r} Z`;
  // Right semicircle (east half, CW arc)
  const rArc = `M ${cx},${cy - r} A ${r},${r} 0 0,1 ${cx},${cy + r} Z`;

  const pepR = 7.5 * s;
  const pepperonis = [
    [cx - 21 * s, cy - 18 * s],
    [cx - 34 * s, cy + 2 * s],
    [cx - 28 * s, cy + 24 * s],
    [cx - 18 * s, cy + 7 * s],
    [cx - 33 * s, cy - 13 * s],
  ];

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <ClipPath id={lId}>
          <Path d={lArc} />
        </ClipPath>
        <ClipPath id={rId}>
          <Path d={rArc} />
        </ClipPath>
      </Defs>

      {/* Crust base */}
      <Circle cx={cx} cy={cy} r={R} fill="#D4956A" />

      {/* Left half: intense red sauce */}
      <Path d={lArc} fill="#E63946" />

      {/* Right half: cheddar yellow */}
      <Path d={rArc} fill="#FFB703" />

      {/* Cheese melt blobs (right) */}
      <G clipPath={`url(#${rId})`}>
        <Ellipse cx={cx + 22 * s} cy={cy - 17 * s} rx={13 * s} ry={8 * s} fill="#FFCB2F" opacity={0.6} />
        <Ellipse cx={cx + 28 * s} cy={cy + 9 * s} rx={12 * s} ry={8 * s} fill="#FFCB2F" opacity={0.5} />
        <Ellipse cx={cx + 11 * s} cy={cy + 25 * s} rx={9 * s} ry={6 * s} fill="#FFCB2F" opacity={0.55} />
        <Ellipse cx={cx + 32 * s} cy={cy - 7 * s} rx={5 * s} ry={4 * s} fill="#FFD94D" opacity={0.4} />
        <Ellipse cx={cx + 14 * s} cy={cy + 1 * s} rx={6 * s} ry={5 * s} fill="#FFD060" opacity={0.38} />
      </G>

      {/* Pepperoni (left) */}
      <G clipPath={`url(#${lId})`}>
        {pepperonis.map(([px, py], i) => (
          <G key={i}>
            <Circle cx={px} cy={py} r={pepR} fill="#8B1518" />
            <Circle cx={px - 1.5 * s} cy={py - 2 * s} r={pepR * 0.46} fill="#C02530" opacity={0.55} />
          </G>
        ))}
      </G>

      {/* Center divider line */}
      <Line
        x1={cx} y1={cy - r}
        x2={cx} y2={cy + r}
        stroke="#141414"
        strokeWidth={2.5 * s}
      />

      {/* Inner crust edge shadow */}
      <Circle cx={cx} cy={cy} r={r} fill="none" stroke="#AA6030" strokeWidth={2 * s} opacity={0.35} />

      {/* Outer dark border */}
      <Circle cx={cx} cy={cy} r={R - 0.5} fill="none" stroke="#1A1A1A" strokeWidth={1.5 * s} />
    </Svg>
  );
}
