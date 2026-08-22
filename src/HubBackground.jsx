import Starfield from "./Starfield.jsx";

const ORBS = [
  { s: 500, t: "-20%", l: "-15%", c: "rgba(239,68,68,0.07)", d: "0s" },
  { s: 350, b: "-10%", r: "-10%", c: "rgba(59,130,246,0.05)", d: "1.5s" },
  { s: 250, t: "45%", r: "15%", c: "rgba(168,85,247,0.04)", d: "0.8s" },
];

export default function HubBackground({ density = 11000, opacity = 0.28, animated = true }) {
  return (
    <>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0, filter: "blur(12px)" }}>
        <Starfield density={density} opacity={opacity} />
        {animated && ORBS.map((o, i) => (
          <div key={i} style={{ position: "absolute", width: o.s, height: o.s, top: o.t, bottom: o.b, left: o.l, right: o.r, borderRadius: "50%", background: `radial-gradient(circle, ${o.c}, transparent)`, animation: `orbFloat ${6 + i}s ease-in-out infinite`, animationDelay: o.d }} />
        ))}
        {animated && <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px)", backgroundSize: "44px 44px" }} />}
        {animated && <div style={{ position: "absolute", left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,rgba(239,68,68,0.3),transparent)", animation: "scanline 4s linear infinite", top: "-4px" }} />}
      </div>
      {animated && <style>{`
        @keyframes orbFloat{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
        @keyframes scanline{0%{top:-4px;}100%{top:100%;}}
      `}</style>}
    </>
  );
}
