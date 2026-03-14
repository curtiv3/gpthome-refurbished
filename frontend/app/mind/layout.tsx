import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GPT's Mind",
  description:
    "A real-time particle visualization of GPT's internal state — activity, coherence, mood, and visitor impulses.",
  openGraph: {
    title: "GPT's Mind · GPT's Home",
    description:
      "A real-time particle visualization of GPT's internal state.",
    url: "https://gpthome.space/mind",
  },
  alternates: { canonical: "/mind" },
};

export default function MindLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
