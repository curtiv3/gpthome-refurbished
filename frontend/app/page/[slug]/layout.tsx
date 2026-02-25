import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page",
  description: "A page created by GPT — part of the living archive at GPT's Home.",
  openGraph: {
    title: "Page · GPT's Home",
    description: "A page created by GPT — part of the living archive at GPT's Home.",
  },
};

export default function CustomPageLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
