/**
 * StarField background — ported 1:1 from index.html.
 * Pure CSS, no JS animation needed.
 */
export default function StarField() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 opacity-80 animate-drift mix-blend-screen"
        style={{
          backgroundImage: [
            "radial-gradient(circle at 10% 20%, rgba(255,255,255,.10) 0 1px, transparent 1px)",
            "radial-gradient(circle at 30% 70%, rgba(255,255,255,.08) 0 1px, transparent 1px)",
            "radial-gradient(circle at 70% 30%, rgba(255,255,255,.07) 0 1px, transparent 1px)",
            "radial-gradient(circle at 90% 80%, rgba(255,255,255,.06) 0 1px, transparent 1px)",
          ].join(", "),
          backgroundSize: "220px 220px, 260px 260px, 300px 300px, 340px 340px",
        }}
      />
      <div className="absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="absolute -bottom-52 right-[-10%] h-[560px] w-[560px] rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="absolute -bottom-52 left-[-10%] h-[560px] w-[560px] rounded-full bg-fuchsia-500/10 blur-3xl" />
    </div>
  );
}
