const AVATAR_COLORS = [
  "#F97316",
  "#EF4444",
  "#EC4899",
  "#8B5CF6",
  "#6366F1",
  "#0EA5E9",
  "#14B8A6",
  "#22C55E",
  "#84CC16",
  "#EAB308",
];

function colorForHandle(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function Avatar({
  name,
  handle,
  avatarUrl,
  className = "h-10 w-10 text-sm",
}: {
  name: string;
  handle: string;
  avatarUrl?: string | null;
  className?: string;
}) {
  const seed = handle || name || "?";
  const initial = (name || handle || "?").trim().charAt(0).toUpperCase();

  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        className={`shrink-0 rounded-full object-cover ${className}`}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      style={{ backgroundColor: colorForHandle(seed) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold text-white ${className}`}
    >
      {initial}
    </span>
  );
}
