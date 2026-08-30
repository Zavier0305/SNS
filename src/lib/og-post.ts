const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://kwlydqelkovmopyjymyz.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt3bHlkcWVsa292bW9weWp5bXl6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc5ODc1NDcsImV4cCI6MjEwMzU2MzU0N30.B63Q4-8RfFi4cNdpS8IGbst3jOAQhHzdqYx_p-q00_M";

export type OgPostMeta = {
  content: string;
  authorDisplayName: string;
  imageUrl: string | null;
} | null;

export async function fetchOgPostMeta(postId: string): Promise<OgPostMeta> {
  try {
    const url = new URL(`${SUPABASE_URL}/rest/v1/sns_posts`);
    url.searchParams.set("id", `eq.${postId}`);
    url.searchParams.set(
      "select",
      "content,image_urls,sns_profiles(display_name)",
    );
    url.searchParams.set("limit", "1");
    const res = await fetch(url.toString(), {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const rows = (await res.json()) as Array<{
      content: string | null;
      image_urls: string[] | null;
      sns_profiles: { display_name: string | null } | null;
    }>;
    const row = rows[0];
    if (!row) return null;
    return {
      content: row.content ?? "",
      authorDisplayName: row.sns_profiles?.display_name ?? "名無しさん",
      imageUrl: row.image_urls?.[0] ?? null,
    };
  } catch {
    return null;
  }
}
