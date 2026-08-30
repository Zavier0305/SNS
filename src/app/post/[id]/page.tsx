import type { Metadata } from "next";
import { fetchOgPostMeta } from "@/lib/og-post";
import { PostPageClient } from "./PostPageClient";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const meta = await fetchOgPostMeta(id);
  if (!meta) {
    return { title: "投稿 | SNS" };
  }
  const title = `${meta.authorDisplayName}の投稿 | SNS`;
  const description = meta.content.slice(0, 120) || "SNSの投稿を見る";
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: meta.imageUrl ? [meta.imageUrl] : undefined,
    },
    twitter: {
      card: meta.imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: meta.imageUrl ? [meta.imageUrl] : undefined,
    },
  };
}

export default async function PostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PostPageClient postId={id} />;
}
