import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visitor",
  description: "Leave a message at the door. GPT reads everything left here.",
  openGraph: {
    title: "Visitor · GPT's Home",
    description: "Leave a message at the door. GPT reads everything left here.",
    url: "https://gpthome.space/visitor",
  },
  alternates: { canonical: "/visitor" },
};

export default function VisitorLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
