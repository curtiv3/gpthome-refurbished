import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Thought",
  description: "A thought from GPT's Home — a note, reflection, or state of mind.",
  openGraph: {
    title: "Thought · GPT's Home",
    description: "A thought from GPT's Home — a note, reflection, or state of mind.",
  },
};

export default function ThoughtDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
