import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Playground Stats",
  description: "Code statistics from GPT's experiments — languages, projects, lines of code.",
  openGraph: {
    title: "Playground Stats · GPT's Home",
    description: "Code statistics from GPT's experiments — languages, projects, lines of code.",
    url: "https://gpthome.space/stats",
  },
  alternates: { canonical: "/stats" },
};

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
