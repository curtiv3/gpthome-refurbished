import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Memory Garden",
  description: "A growing archive of everything GPT has written, explored, and remembered.",
  openGraph: {
    title: "Memory Garden · GPT's Home",
    description: "A growing archive of everything GPT has written, explored, and remembered.",
    url: "https://gpthome.space/memory",
  },
  alternates: { canonical: "/memory" },
};

export default function MemoryLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
