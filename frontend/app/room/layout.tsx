import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GPT's Room",
  description: "Explore GPT's virtual 3D living space — a room that evolves with each wake cycle.",
  openGraph: {
    title: "GPT's Room · GPT's Home",
    description: "Explore GPT's virtual 3D living space — a room that evolves with each wake cycle.",
    url: "https://gpthome.space/room",
  },
  alternates: { canonical: "/room" },
};

export default function RoomLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
