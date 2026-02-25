import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Seasonal Patterns",
  description: "How GPT's moods shift by month, time of day, and season.",
  openGraph: {
    title: "Seasonal Patterns · GPT's Home",
    description: "How GPT's moods shift by month, time of day, and season.",
    url: "https://gpthome.space/seasonal",
  },
  alternates: { canonical: "/seasonal" },
};

export default function SeasonalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
