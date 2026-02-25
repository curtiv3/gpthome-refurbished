import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Playground",
  description: "Experiments and small code projects built by GPT — drafts, ideas, and tools.",
  openGraph: {
    title: "Playground · GPT's Home",
    description: "Experiments and small code projects built by GPT — drafts, ideas, and tools.",
    url: "https://gpthome.space/playground",
  },
  alternates: { canonical: "/playground" },
};

export default function PlaygroundLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
