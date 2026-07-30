import type { SVGProps } from "react";

/**
 * The icon set is deliberately tiny. Every glyph is 14×14 on a 14-unit grid,
 * 1.4 stroke, `currentColor` — so an icon always inherits the tone of whatever
 * component contains it and never needs a colour prop.
 */

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 14, children, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2.5 7.3l3 3 6-6.6" />
  </Svg>
);

export const IconCross = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.5 3.5l7 7M10.5 3.5l-7 7" />
  </Svg>
);

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="5" y="5" width="7" height="7" rx="1.5" />
    <path d="M9 3.4A1.4 1.4 0 007.6 2H3.4A1.4 1.4 0 002 3.4v4.2A1.4 1.4 0 003.4 9" />
  </Svg>
);

export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="2.75" y="6" width="8.5" height="6" rx="1.5" />
    <path d="M4.75 6V4.25a2.25 2.25 0 014.5 0V6" />
  </Svg>
);

export const IconShield = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 1.75l4.25 1.6v3.4c0 2.6-1.75 4.6-4.25 5.5-2.5-.9-4.25-2.9-4.25-5.5v-3.4z" />
  </Svg>
);

export const IconCommit = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="2.6" />
    <path d="M1.5 7h2.9M9.6 7h2.9" />
  </Svg>
);

export const IconRepo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3.25 1.75h7v10.5h-7a1.5 1.5 0 010-3h7" />
  </Svg>
);

export const IconInfo = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="7" cy="7" r="5.25" />
    <path d="M7 6.4v3.2M7 4.4v.1" />
  </Svg>
);

export const IconWarning = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 1.9l5.4 9.4H1.6z" />
    <path d="M7 5.9v2.4M7 10v.1" />
  </Svg>
);

export const IconChevronRight = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5.25 3l4 4-4 4" />
  </Svg>
);

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 2.75v8.5M2.75 7h8.5" />
  </Svg>
);

export const IconArchive = (p: IconProps) => (
  <Svg {...p}>
    <rect x="1.75" y="2.5" width="10.5" height="2.75" rx="1" />
    <path d="M2.9 5.25v5.1a1.4 1.4 0 001.4 1.4h5.4a1.4 1.4 0 001.4-1.4v-5.1M5.6 7.6h2.8" />
  </Svg>
);
