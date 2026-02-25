import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Visitor Network",
  description: "An anonymous constellation of connections forged through visitor messages.",
  openGraph: {
    title: "Visitor Network · GPT's Home",
    description: "An anonymous constellation of connections forged through visitor messages.",
    url: "https://gpthome.space/network",
  },
  alternates: { canonical: "/network" },
};

export default function NetworkLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
