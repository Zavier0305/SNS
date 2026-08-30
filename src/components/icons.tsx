import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function HomeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6 9.5V20h12V9.5" />
    </Base>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m20 20-4.8-4.8" />
    </Base>
  );
}

export function SparkleIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18" />
    </Base>
  );
}

export function BellIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 9a6 6 0 1 1 12 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9Z" />
      <path d="M9.5 18a2.5 2.5 0 0 0 5 0" />
    </Base>
  );
}

export function BookmarkIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 4h12v16l-6-4-6 4V4Z" />
    </Base>
  );
}

export function ServersIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </Base>
  );
}

export function SettingsIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v3M12 18.5v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2.5 12h3M18.5 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </Base>
  );
}

export function UserIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </Base>
  );
}

export function LogoutIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 4H5v16h4" />
      <path d="M13 8l4 4-4 4M8 12h9" />
    </Base>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 5v14M5 12h14" />
    </Base>
  );
}

export function HeartIcon({ filled, ...props }: IconProps & { filled?: boolean }) {
  return (
    <Base fill={filled ? "currentColor" : "none"} {...props}>
      <path d="M12 20s-7-4.4-9.5-9C1 7.5 3 4 6.5 4c2 0 3.6 1.3 5.5 3.5C13.9 5.3 15.5 4 17.5 4 21 4 23 7.5 21.5 11c-2.5 4.6-9.5 9-9.5 9Z" />
    </Base>
  );
}

export function CommentIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </Base>
  );
}

export function RepostIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 8h10l-2.5-2.5M18 16H8l2.5 2.5" />
      <path d="M6 8v6a2 2 0 0 0 2 2h2M18 16v-6a2 2 0 0 0-2-2h-2" />
    </Base>
  );
}

export function ShareIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="18" cy="5" r="2.3" />
      <circle cx="6" cy="12" r="2.3" />
      <circle cx="18" cy="19" r="2.3" />
      <path d="m8 10.7 8-4.4M8 13.3l8 4.4" />
    </Base>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 17 5-5 4 4 3-3 3 3" />
    </Base>
  );
}

export function PollIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M5 20V10M12 20V4M19 20v-6" />
    </Base>
  );
}

export function WarningIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M12 4 3 19h18L12 4Z" />
      <path d="M12 10.5v3.5M12 17h.01" />
    </Base>
  );
}

export function PinIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M9 4h6l-.7 6.3L18 14v2H6v-2l3.7-3.7L9 4Z" />
      <path d="M12 16v4" />
    </Base>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5.5" y="10.5" width="13" height="9" rx="1.5" />
      <path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3" />
    </Base>
  );
}

export function SunIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2.5M12 19v2.5M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2.5 12H5M19 12h2.5M4.2 19.8 6 18M18 6l1.8-1.8" />
    </Base>
  );
}

export function MoonIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z" />
    </Base>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </Base>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Base>
  );
}

export function BookmarkFilledIcon(props: IconProps) {
  return (
    <Base fill="currentColor" {...props}>
      <path d="M6 4h12v16l-6-4-6 4V4Z" />
    </Base>
  );
}
