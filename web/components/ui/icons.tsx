import type { ReactNode, SVGProps } from "react";

/** Stroke 1.7 em grade de 24 — o traço fino é parte da postura do sistema. */
function Svg({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconSun = () => (
  <Svg>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
);

export const IconMoon = () => (
  <Svg>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </Svg>
);

export const IconSearch = () => (
  <Svg>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
);

export const IconCheck = () => (
  <Svg>
    <path d="M20 6 9 17l-5-5" />
  </Svg>
);

export const IconX = () => (
  <Svg>
    <path d="M18 6 6 18M6 6l12 12" />
  </Svg>
);

export const IconAlert = () => (
  <Svg>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
  </Svg>
);

export const IconInfo = () => (
  <Svg>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 16v-4M12 8h.01" />
  </Svg>
);

export const IconInbox = () => (
  <Svg>
    <path d="M22 12h-6l-2 3h-4l-2-3H2" />
    <path d="M5.5 5h13l3.5 7v5a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-5z" />
  </Svg>
);

export const IconLayout = () => (
  <Svg>
    <rect x="3" y="3.5" width="18" height="17" rx="2" />
    <path d="M3 9h18M10 9v11.5" />
  </Svg>
);

export const IconArchive = () => (
  <Svg>
    <rect x="3" y="3.5" width="18" height="4.5" rx="1" />
    <path d="M5 8v10.5a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" />
    <path d="M10 12h4" />
  </Svg>
);

export const IconLedger = () => (
  <Svg>
    <path d="M4 4.5h13a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z" />
    <path d="M8 3v3M9 10h6M9 14h6M9 18h3" />
  </Svg>
);

export const IconSliders = () => (
  <Svg>
    <path d="M3 7h6M13 7h8M3 12h10M17 12h4M3 17h3M10 17h11" />
    <circle cx="11" cy="7" r="2" />
    <circle cx="15" cy="12" r="2" />
    <circle cx="8" cy="17" r="2" />
  </Svg>
);

export const IconPencil = () => (
  <Svg>
    <path d="M16.4 3.6a2.3 2.3 0 0 1 3.2 3.2L8 18.4l-4.2 1.2 1.2-4.2z" />
    <path d="M14.5 5.5 18 9" />
  </Svg>
);

/** Seta saindo da moldura: leva para fora do app, em outra aba. */
export const IconExternal = () => (
  <Svg>
    <path d="M14 4h6v6" />
    <path d="M20 4 11.5 12.5" />
    <path d="M18.5 14.5V19a1.5 1.5 0 0 1-1.5 1.5H5.5A1.5 1.5 0 0 1 4 19V7.5A1.5 1.5 0 0 1 5.5 6H10" />
  </Svg>
);

/** Seta descendo para dentro da bandeja: o que sai daqui é um .zip baixado. */
export const IconExport = () => (
  <Svg>
    <path d="M12 3v11" />
    <path d="m8 10.5 4 4 4-4" />
    <path d="M4 16.5v3A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-3" />
  </Svg>
);

export const IconImage = () => (
  <Svg>
    <rect x="3" y="4.5" width="18" height="15" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="m4 17 4.5-4.5a1.6 1.6 0 0 1 2.2 0L15 17" />
    <path d="m13.5 15.5 2-2a1.6 1.6 0 0 1 2.2 0L20 15.6" />
  </Svg>
);

export const IconHeart = () => (
  <Svg>
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l8.8 8.8 8.8-8.8a5.5 5.5 0 0 0 0-7.8z" />
  </Svg>
);

export const IconBubble = () => (
  <Svg>
    <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z" />
  </Svg>
);

export const IconSend = () => (
  <Svg>
    <path d="m22 2-7 20-4-9-9-4z" />
  </Svg>
);

export const IconTool = () => (
  <Svg>
    <path d="M14.7 6.3a4 4 0 0 0 5.3 5.3l-8.4 8.4a2.8 2.8 0 0 1-4-4z" />
  </Svg>
);

export const IconPlug = () => (
  <Svg>
    <path d="M9 2v6M15 2v6M6 8h12v3a6 6 0 0 1-12 0z" />
    <path d="M12 17v5" />
  </Svg>
);

export const IconLogout = () => (
  <Svg>
    <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
    <path d="M10 8 6 12l4 4" />
    <path d="M6 12h9" />
  </Svg>
);

export const IconLock = () => (
  <Svg>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Svg>
);

export const IconVault = () => (
  <Svg>
    <path d="m12 2.5 8.5 4.5-8.5 4.5L3.5 7z" />
    <path d="m3.5 12 8.5 4.5 8.5-4.5" />
    <path d="m3.5 16.5 8.5 4.5 8.5-4.5" />
  </Svg>
);

export const NAV_ICONS = {
  layout: IconLayout,
  inbox: IconInbox,
  archive: IconArchive,
  bubble: IconBubble,
  ledger: IconLedger,
  sliders: IconSliders,
  vault: IconVault,
} as const;

export type NavIconName = keyof typeof NAV_ICONS;
