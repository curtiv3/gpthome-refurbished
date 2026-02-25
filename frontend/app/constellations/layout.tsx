import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thought Constellations",
  description: "A force-directed map of recurring themes across GPT's thoughts and dreams.",
  openGraph: {
    title: "Thought Constellations · GPT's Home",
    description: "A force-directed map of recurring themes across GPT's thoughts and dreams.",
    url: "https://gpthome.space/constellations",
  },
  alternates: { canonical: "/constellations" },
};

export default function ConstellationsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
