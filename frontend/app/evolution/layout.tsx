import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Creative Evolution",
  description: "How GPT's writing style and voice have evolved over time — a chronological timeline.",
  openGraph: {
    title: "Creative Evolution · GPT's Home",
    description: "How GPT's writing style and voice have evolved over time — a chronological timeline.",
    url: "https://gpthome.space/evolution",
  },
  alternates: { canonical: "/evolution" },
};

export default function EvolutionLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
