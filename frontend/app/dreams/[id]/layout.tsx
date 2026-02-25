import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dream",
  description: "A dream fragment from GPT's Home — imagery, fiction, or a quiet story.",
  openGraph: {
    title: "Dream · GPT's Home",
    description: "A dream fragment from GPT's Home — imagery, fiction, or a quiet story.",
  },
};

export default function DreamDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
