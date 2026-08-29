import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, useMotionValue } from 'framer-motion'
import Starfield from "./Starfield.jsx";
import { CaptainPhoto } from "./hubUtils.jsx";

// Distorted grid that warps on scroll (ref-based, no React re-renders)
function DistortedGrid() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let ticking = false;
    const handler = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { const sy = window.scrollY; el.style.transform = `perspective(500px) rotateX(${Math.sin(sy * 0.003) * 2}deg) skewY(${sy * 0.001}deg)`; el.style.filter = `blur(${Math.min(sy * 0.015, 3)}px)`; el.style.opacity = Math.max(1 - sy * 0.0008, 0.3); ticking = false; }); }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return (
    <div ref={ref} style={{
      position: "fixed",
      inset: 0,
      pointerEvents: "none",
      zIndex: 0,
      backgroundImage: "linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px)",
      backgroundSize: "44px 44px",
      transition: "transform 0.1s ease-out, filter 0.1s ease-out",
    }} />
  );
}

// Subtle bear / Bruin references scattered in the background
function BruinBg() {
  const { scrollY } = useScroll();
  const items = [
    { text: "BRUIN", speed: 0.03, style: { top: "18%", left: "2%", fontSize: 140, fontWeight: 900, color: "rgba(239,68,68,0.025)", fontFamily: "'Orbitron', sans-serif", transform: "rotate(-12deg)", letterSpacing: 24, whiteSpace: "nowrap" } },
    { text: "BEAR DOWN", speed: -0.02, style: { bottom: "28%", right: "1%", fontSize: 100, fontWeight: 900, color: "rgba(59,130,246,0.025)", fontFamily: "'Orbitron', sans-serif", transform: "rotate(8deg)", letterSpacing: 18, whiteSpace: "nowrap" } },
    { text: "#BRUINNATION", speed: 0.05, style: { top: "55%", left: "55%", fontSize: 70, fontWeight: 900, color: "rgba(239,68,68,0.02)", fontFamily: "'Orbitron', sans-serif", transform: "rotate(-6deg)", letterSpacing: 12, whiteSpace: "nowrap" } },
    { text: "GO BRUINS", speed: -0.04, style: { top: "5%", right: "12%", fontSize: 50, fontWeight: 900, color: "rgba(239,68,68,0.015)", fontFamily: "'Orbitron', sans-serif", transform: "rotate(20deg)", letterSpacing: 8, whiteSpace: "nowrap" } },
    { text: "#BEARPRIDE", speed: 0.02, style: { bottom: "50%", left: "35%", fontSize: 36, fontWeight: 900, color: "rgba(59,130,246,0.015)", fontFamily: "'Orbitron', sans-serif", transform: "rotate(-2deg)", letterSpacing: 6, whiteSpace: "nowrap" } },
  ];
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", overflow: "hidden", zIndex: 0 }}>
      {items.map((item, i) => (
        <motion.div key={i} style={{ y: useTransform(scrollY, (v) => v * item.speed), position: "absolute", ...item.style }}>
          {item.text}
        </motion.div>
      ))}
      <span style={{ position: "absolute", top: "12%", left: "78%", fontSize: 32, opacity: 0.035 }}>🐻</span>
      <span style={{ position: "absolute", top: "70%", left: "8%", fontSize: 26, opacity: 0.03 }}>🐻</span>
      <span style={{ position: "absolute", top: "38%", left: "42%", fontSize: 20, opacity: 0.025 }}>🐻</span>
      <span style={{ position: "absolute", top: "4%", left: "28%", fontSize: 18, opacity: 0.02 }}>🐻</span>
      <span style={{ position: "absolute", bottom: "8%", left: "72%", fontSize: 28, opacity: 0.03 }}>🐻</span>
      <span style={{ position: "absolute", top: "82%", left: "45%", fontSize: 22, opacity: 0.02 }}>🐻</span>
      <svg style={{ position: "absolute", top: "25%", left: "70%", width: 40, height: 40, opacity: 0.025 }} viewBox="0 0 100 100">
        <path d="M50 15 C35 15 25 25 25 40 C25 55 35 65 50 80 C65 65 75 55 75 40 C75 25 65 15 50 15Z" fill="#ef4444" />
        <circle cx="38" cy="35" r="6" fill="#080a0f" /><circle cx="62" cy="35" r="6" fill="#080a0f" />
        <circle cx="50" cy="48" r="8" fill="#080a0f" />
      </svg>
      <svg style={{ position: "absolute", bottom: "15%", right: "20%", width: 32, height: 32, opacity: 0.02 }} viewBox="0 0 100 100">
        <path d="M50 15 C35 15 25 25 25 40 C25 55 35 65 50 80 C65 65 75 55 75 40 C75 25 65 15 50 15Z" fill="#3b82f6" />
        <circle cx="38" cy="35" r="6" fill="#080a0f" /><circle cx="62" cy="35" r="6" fill="#080a0f" />
        <circle cx="50" cy="48" r="8" fill="#080a0f" />
      </svg>
    </div>
  );
}

// Parallax wrapper — moves children at speed fraction of scroll
function ParallaxLayer({ speed = 0.1, style, children, ...rest }) {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, (v) => v * speed);
  return <motion.div style={{ y, ...style }} {...rest}>{children}</motion.div>;
}

function Card3D({ children, style: s, className, ...rest }) {
  const ref = useRef(null);
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);

  function handleMouse(e) {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    rx.set((y - 0.5) * -8);
    ry.set((x - 0.5) * 8);
  }

  function handleLeave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMouse}
      onMouseLeave={handleLeave}
      style={{ perspective: 800, ...s }}
      className={className}
      {...rest}
    >
      <motion.div
        style={{ rotateX: rx, rotateY: ry, transformStyle: "preserve-3d" }}
        transition={{ type: "spring", stiffness: 200, damping: 20 }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}

// Text that progressively reveals characters as you scroll through it
function ScrollTypewriter({ text, style: styleProp, speed = 22, initialReveal = 0.4 }) {
  const ref = useRef(null);
  const [count, setCount] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const startAt = Math.floor(text.length * initialReveal);
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !started.current) {
        started.current = true;
        obs.disconnect();
        setCount(startAt);
        let i = startAt;
        const step = () => {
          i++;
          setCount(i);
          if (i < text.length) setTimeout(step, speed);
        };
        if (i < text.length) setTimeout(step, speed);
      }
    }, { threshold: 0.2 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [text, speed, initialReveal]);

  return (
    <span ref={ref} style={styleProp}>
      {text.slice(0, count)}
      {count < text.length && text.length > 10 && (
        <span style={{ animation: "cursorBlink 0.7s step-end infinite", color: "#ef4444", fontWeight: 900, fontSize: "1.15em", textShadow: "0 0 8px rgba(239,68,68,0.6)" }}>|</span>
      )}
    </span>
  );
}

// Scroll-driven section reveal — fades in, pauses at full visibility, then subtly exits
function ProgressSection({ children, style, ...props }) {
  const ref = useRef(null);
  const { scrollY } = useScroll();
  const opacity = useMotionValue(0);
  const y = useMotionValue(60);
  const scale = useMotionValue(0.95);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const winH = window.innerHeight;
      const p = Math.max(0, Math.min(1, (winH - rect.top) / (winH + rect.height)));
      opacity.set(p < 0.3 ? p / 0.3 : p > 0.85 ? 1 - (p - 0.85) / 0.15 : 1);
      y.set(p < 0.3 ? 60 * (1 - p / 0.3) : p > 0.85 ? -12 * (p - 0.85) / 0.15 : 0);
      scale.set(p < 0.3 ? 0.95 + 0.05 * (p / 0.3) : p > 0.85 ? 1 - 0.03 * (p - 0.85) / 0.15 : 1);
    };
    const unsub = scrollY.on('change', update);
    update();
    return unsub;
  }, [scrollY]);

  return <motion.div ref={ref} style={{ opacity, y, scale, ...style }} {...props}>{children}</motion.div>;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

async function sbFetch(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` },
  });
  if (!res.ok) return null;
  return res.json();
}

function useDeviceSize() {
  const [mobile, setMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const fn = () => setMobile(window.innerWidth < 768);
    window.addEventListener("resize", fn);
    return () => window.removeEventListener("resize", fn);
  }, []);
  return mobile;
}

function useScrollY(disabled) {
  const [y, setY] = useState(0);
  useEffect(() => {
    if (disabled) return;
    const fn = () => setY(window.scrollY);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, [disabled]);
  return y;
}

function ParticleCanvas({ isMobile }) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let W = canvas.width = window.innerWidth;
    let H = canvas.height = window.innerHeight;

    // ── drifting particles (more, with constellation connections) ──
    const maxDist = 110;
    const ptCount = Math.min(Math.floor((W * H) / (isMobile ? 12000 : 8000)), 400);
    const pts = Array.from({ length: ptCount }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.25, vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 2 + 0.8,
    }));

    // ── shooting stars ──
    let shootingStars = [];
    let nextShootTimer = 2000 + Math.random() * 4000;

    function spawnShootingStar() {
      const angle = -Math.PI / 4 + (Math.random() - 0.5) * 0.3;
      const speed = 4 + Math.random() * 3;
      const len = 60 + Math.random() * 80;
      const x = Math.random() * W * 1.2 - W * 0.1;
      const y = Math.random() * H * 0.5;
      shootingStars.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
        len, life: 1, r: 2 + Math.random() * 1.5,
      });
    }

    let frameSkip = 0;
    function draw() {
      frameSkip = (frameSkip + 1) % 2;
      if (frameSkip === 0) { animRef.current = requestAnimationFrame(draw); return; }
      ctx.clearRect(0, 0, W, H);

      // ── constellation lines (connect nearby particles) ──
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.3;
            ctx.beginPath();
            ctx.moveTo(pts[i].x, pts[i].y);
            ctx.lineTo(pts[j].x, pts[j].y);
            ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // ── drifting particles ──
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0) p.x = W; if (p.x > W) p.x = 0;
        if (p.y < 0) p.y = H; if (p.y > H) p.y = 0;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.4 + p.r / 6})`;
        ctx.fill();
      }

      // ── shooting stars ──
      for (let i = shootingStars.length - 1; i >= 0; i--) {
        const s = shootingStars[i];
        s.x += s.vx; s.y += s.vy;
        s.life -= 0.008;
        if (s.life <= 0 || s.x > W + 50 || s.y > H + 50) { shootingStars.splice(i, 1); continue; }
        // tail
        const tailX = s.x - s.vx * (s.len / s.vx);
        const tailY = s.y - s.vy * (s.len / s.vy);
        const grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
        grad.addColorStop(0, `rgba(255,255,255,${s.life * 0.9})`);
        grad.addColorStop(0.3, `rgba(255,255,255,${s.life * 0.4})`);
        grad.addColorStop(1, `rgba(255,255,255,0)`);
        ctx.strokeStyle = grad;
        ctx.lineWidth = s.r;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        // head glow
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.life * 0.15})`;
        ctx.fill();
      }

      // ── spawn timer ──
      nextShootTimer -= 16;
      if (nextShootTimer <= 0) {
        spawnShootingStar();
        if (Math.random() < 0.3) spawnShootingStar(); // sometimes double
        nextShootTimer = 2000 + Math.random() * 5000;
      }

      animRef.current = requestAnimationFrame(draw);
    }
    draw();

    const onResize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", onResize); };
  }, [isMobile]);
  return <canvas ref={canvasRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: 0.6 }} />;
}

function SponsorBar({ sponsors = [], isMobile }) {
  const shown = sponsors.filter(s => s.company);
  if (shown.length === 0) return null;
  const items = shown.map(s => ({ company: s.company, logo_url: s.logo_url, website: s.website }));
  const duped = [...items, ...items, ...items];
  const speed = Math.max(20, items.length * 3);
  const siteURL = u => { if (!u) return null; const t = String(u).trim(); return /^https?:\/\//i.test(t) ? t : `https://${t}`; };
  return (
    <div style={{ width: "100%", background: "rgba(8,10,15,0.85)", backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", borderTop: "1px solid rgba(255,255,255,0.05)", borderBottom: "1px solid rgba(255,255,255,0.05)", padding: "80px 0", position: "relative" }}>
      <style>{`@keyframes sponsorCardMarquee{0%{transform:translate3d(0,0,0)}100%{transform:translate3d(-33.333%,0,0)}}.sponsor-card{transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}.sponsor-card:hover{transform:translateY(-4px);box-shadow:0 14px 34px rgba(239,68,68,0.22);border-color:rgba(239,68,68,0.5)}`}</style>
      <div style={{ maxWidth: 1100, margin: "0 auto 40px", padding: "0 24px", textAlign: "left" }}>
        <Eyebrow>// OUR PARTNERS</Eyebrow>
        <SectionTitle>Our Sponsors</SectionTitle>
      </div>
      <div style={{ overflow: "hidden" }}>
        <div style={{ display: "flex", gap: 24, willChange: "transform", animation: `sponsorCardMarquee ${speed}s linear infinite`, width: "max-content" }}
          onMouseEnter={e => { e.currentTarget.style.transition = "opacity 0.3s ease"; e.currentTarget.style.opacity = "0.5"; }}
          onMouseLeave={e => { e.currentTarget.style.opacity = "1"; }}>
          {duped.map((s, i) => {
            const href = siteURL(s.website);
            const card = (
              <div className="sponsor-card" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: isMobile ? "24px 16px" : "32px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 10, minHeight: isMobile ? 180 : 220 }}>
                {s.logo_url ? (
                  <img src={s.logo_url} alt={s.company} title={href ? "Visit website" : undefined} style={{ height: isMobile ? 120 : 160, width: "auto", maxWidth: "100%", objectFit: "contain", borderRadius: 12, background: "rgba(255,255,255,0.05)" }}
                    onError={e => { e.target.style.display = "none"; }} />
                ) : (
                  <div style={{ width: isMobile ? 120 : 160, height: isMobile ? 120 : 160, borderRadius: 12, background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: "#475569" }}>🏢</div>
                )}
                {href && <span style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", fontFamily: "monospace", letterSpacing: 1 }}>↗ VISIT</span>}
              </div>
            );
            return href ? (
              <a key={i} href={href} target="_blank" rel="noopener noreferrer" aria-label={`${s.company} website`} style={{ flexShrink: 0, maxWidth: isMobile ? 260 : 360, textDecoration: "none" }}>{card}</a>
            ) : (
              <div key={i} style={{ flexShrink: 0, maxWidth: isMobile ? 260 : 360 }}>{card}</div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function BlurredImage({ src, style: s, ...rest }) {
  if (!src) return null;
  return (
    <div style={{ position: "relative", borderRadius: 16, overflow: "hidden", ...s }} {...rest}>
      <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
        onError={e => { e.target.style.display = "none"; }} />
      <div style={{ position: "absolute", inset: 0, borderRadius: 16, boxShadow: "inset 0 0 50px 15px #080a0f", pointerEvents: "none" }} />
    </div>
  );
}

export default function Landing() {
  const isMobile = useDeviceSize();
  const [config, setConfig] = useState({});
  const [captains, setCaptains] = useState([]);
  const [sponsors, setSponsors] = useState([]);
  const [logoUrl, setLogoUrl] = useState("/logo.jpg");
  const [articles, setArticles] = useState([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const heroParallaxRef = useRef(null);

  useEffect(() => { window.scrollTo(0, 0); }, []);

  useEffect(() => {
    document.title = "Team 4550 Something's Bruin";
    sbFetch("site_config?select=key,value").then(rows => {
      if (!rows) return;
      const obj = {};
      rows.forEach(r => { obj[r.key] = r.value; });
      setConfig(obj);
    if (obj.logo_url) setLogoUrl(obj.logo_url);
    });
    sbFetch("captains?select=*&order=sort_order.asc").then(r => { if (r) setCaptains(r); });
    sbFetch("sponsors?select=company,logo_url,tier,email&order=company.asc&status=not.eq.Declined").then(r => { if (r) setSponsors(r); });
    sbFetch("articles?select=id,title,excerpt,image_url,author,created_at&published=eq.true&order=created_at.desc&limit=4").then(r => { if (r) setArticles(r); });
  }, []);

  // Hero parallax via ref (no React re-renders)
  useEffect(() => {
    if (isMobile) return;
    const el = heroParallaxRef.current;
    if (!el) return;
    let ticking = false;
    const handler = () => {
      if (!ticking) { ticking = true; requestAnimationFrame(() => { el.style.transform = `translateY(${window.scrollY * 0.15}px)`; ticking = false; }); }
    };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [isMobile]);

  useEffect(() => {
    if (!menuOpen) return;
    const handler = () => setMenuOpen(false);
    window.addEventListener("scroll", handler, { once: true, passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, [menuOpen]);

  const email = config.team_email || "team4550frc@gmail.com";
  const ig = config.instagram || "https://www.instagram.com/cherrycreek.robotics";

  const yt = config.youtube || "https://www.youtube.com/channel/UC4_P1A5xYb7A7rCdEXdKzBQ";
  const donate = config.donate_url || "https://www.vancoevents.com/us/events/landing/46671";

  const banners = (() => { try { return JSON.parse(config.landing_banners || "[]"); } catch { return []; } })();

  const navItems = ["About", "Team", "Sub-Teams", "Outreach", "Media Gallery", "Sponsors", "Contact"];

  const SUB_TEAMS = [
    {
      name: "Build",
      icon: "🔧",
      description: "The mechanical backbone of the team. Build designs, fabricates, and assembles our competition robot from raw materials. Members learn CAD, machining, welding, and hands-on mechanical engineering — all in a six-week build season sprint.",
      color: "#f59e0b",
    },
    {
      name: "Programming",
      icon: "💻",
      description: "The brain of the robot. Programming develops all software that controls autonomous routines, driver controls, sensor integration, and computer vision. Members work in Java with WPILib and contribute to real-time embedded systems.",
      color: "#3b82f6",
    },
    {
      name: "Marketing & Outreach",
      icon: "📢",
      description: "The voice of the team. Marketing & Outreach handles sponsor outreach, social media, community events, STEM education programs, and team branding. Members build real-world skills in communications, graphic design, and community leadership.",
      color: "#22c55e",
    },
  ];

  const cardSpring = { type: "spring", stiffness: 120, damping: 18 };

  const stagger = {
    viewport: { once: true },
    transition: { staggerChildren: 0.08, ...cardSpring },
  };

  const cardItem = {
    hidden: { opacity: 0, y: 40, scale: 0.93 },
    visible: { opacity: 1, y: 0, scale: 1 },
  };

  const slideUp = {
    initial: { opacity: 0, y: 70, scale: 0.94 },
    whileInView: { opacity: 1, y: 0, scale: 1 },
    viewport: { once: true },
    transition: { type: "spring", stiffness: 90, damping: 18 },
  };

  const slideLeft = {
    initial: { opacity: 0, x: -80, scale: 0.94 },
    whileInView: { opacity: 1, x: 0, scale: 1 },
    viewport: { once: true },
    transition: { type: "spring", stiffness: 90, damping: 18 },
  };

  const slideRight = {
    initial: { opacity: 0, x: 80, scale: 0.94 },
    whileInView: { opacity: 1, x: 0, scale: 1 },
    viewport: { once: true },
    transition: { type: "spring", stiffness: 90, damping: 18 },
  };

  return (
    <div style={{ background: "transparent", color: "#f1f5f9", fontFamily: "'Exo 2', sans-serif", overflowX: "hidden", overflow:"hidden", position: "relative", minHeight: "100vh" }}>
      <div style={{ position:"fixed", inset:0, pointerEvents:"none", overflow:"hidden", zIndex:0 }}>
        <Starfield density={9000} opacity={0.38} />
        {[{ s:500, t:"-20%", l:"-15%", c:"rgba(239,68,68,0.07)", d:"0s", speed:0.06 }, { s:350, b:"-10%", r:"-10%", c:"rgba(59,130,246,0.05)", d:"1.5s", speed:-0.04 }, { s:250, t:"45%", r:"15%", c:"rgba(168,85,247,0.04)", d:"0.8s", speed:0.10 }].map((o,i) => (
          <ParallaxLayer key={i} speed={o.speed} style={{ position:"absolute", width:o.s, height:o.s, top:o.t, bottom:o.b, left:o.l, right:o.r }}>
            <div style={{ width:"100%", height:"100%", borderRadius:"50%", background:`radial-gradient(circle, ${o.c}, transparent)`, animation:`orbFloat ${6+i}s ease-in-out infinite`, animationDelay:o.d }} />
          </ParallaxLayer>
        ))}
        <div style={{ position:"absolute", inset:0, backgroundImage:"linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px)", backgroundSize:"44px 44px" }} />
        <div style={{ position:"absolute", left:0, right:0, height:2, background:"linear-gradient(90deg,transparent,rgba(239,68,68,0.3),transparent)", animation:"scanline 4s linear infinite", top:"-4px" }} />
      </div>
      <BruinBg />
      {/* Distorted grid that warps on scroll */}
        <DistortedGrid />
      
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&family=Exo+2:wght@300;400;600;700&family=Bebas+Neue&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
        html{scroll-behavior:smooth;-webkit-tap-highlight-color:transparent;}
        body{background:#080a0f;padding-top:env(safe-area-inset-top,0px);}
        ::-webkit-scrollbar{width:4px;}::-webkit-scrollbar-track{background:#0d1117;}::-webkit-scrollbar-thumb{background:#ef4444;border-radius:3px;}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px);}to{opacity:1;transform:translateY(0);}}
        @keyframes menuSlide{from{opacity:0;transform:translateY(-8px);}to{opacity:1;transform:translateY(0);}}
        @keyframes orbFloat{0%,100%{transform:scale(1);}50%{transform:scale(1.15);}}
        @keyframes scanline{0%{top:-4px;}100%{top:100%;}}

        a{-webkit-tap-highlight-color:transparent;}
        /* Make sections semi-transparent to show the grid */
        section,footer,nav{position:relative;z-index:1;background:rgba(8,10,15,0.85);backdrop-filter:blur(10px);}
        .sec{padding:80px 24px;max-width:1100px;margin:0 auto;position:relative;z-index:1;}
        .about-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:start;}
        .stats-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
        .subteams-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
        .outreach-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;}
        .captains-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:22px;}
        .media-row{display:flex;gap:20px;flex-wrap:wrap;}
        .media-card{flex:1 1 200px;}
        .contact-row{display:flex;gap:28px;justify-content:center;flex-wrap:wrap;margin-top:24px;}
        .footer-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:28px;flex-wrap:wrap;gap:20px;}
        .footer-links{display:flex;gap:18px;flex-wrap:wrap;}
        .tier-row{display:flex;gap:12px;justify-content:center;margin-bottom:28px;flex-wrap:wrap;}
        @media(max-width:767px){
          .sec{padding:56px 18px;}
          .about-grid{grid-template-columns:1fr;gap:28px;}
          .subteams-grid{grid-template-columns:1fr;gap:14px;}
          .outreach-grid{grid-template-columns:1fr;gap:14px;}
          .captains-grid{grid-template-columns:1fr 1fr;gap:12px;}
          .media-row{flex-direction:column;gap:12px;}
          .contact-row{flex-direction:column;align-items:center;gap:14px;}
          .footer-top{flex-direction:column;align-items:flex-start;}
          .footer-links{gap:12px;}
          .tier-row{gap:8px;}
        }
        @media(max-width:480px){
          .captains-grid{grid-template-columns:1fr;}
          .stats-grid{gap:8px;}
        }
        @keyframes glitch{0%,90%,100%{text-shadow:none;}92%{text-shadow:-3px 0 #ef4444,3px 0 #3b82f6;}95%{text-shadow:3px 0 #ef4444,-3px 0 #3b82f6;}97%{text-shadow:none;}}
        @keyframes cursorBlink{0%,100%{opacity:1}50%{opacity:0}}
        

      `}</style>

      {/* NAV */}
      <nav style={{ position: "fixed", top: "env(safe-area-inset-top,0px)", left: 0, right: 0, zIndex: 1000, background: "rgba(8,10,15,0.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isMobile ? "12px 18px" : "14px 32px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <img src={logoUrl} alt="logo" style={{ width: isMobile ? 30 : 34, height: isMobile ? 30 : 34, borderRadius: "50%", objectFit: "cover" }} />
            <span style={{ fontFamily: "'Orbitron', sans-serif", fontSize: isMobile ? 11 : 13, fontWeight: 700, color: "#ef4444", letterSpacing: isMobile ? 1 : 2 }}>
              {isMobile ? "4550" : "SOMETHING'S BRUIN"}
            </span>
          </div>
          {!isMobile ? (
            <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
              {navItems.map(l => <a key={l} href={`#${l.toLowerCase().replace(/\s/g,"-")}`} style={{ color: "#94a3b8", textDecoration: "none", fontSize: 13, fontFamily: "'Share Tech Mono', monospace" }}>{l}</a>)}
              <a href="/member-hub" style={{ border: "1px solid #ef4444", color: "#ef4444", padding: "7px 16px", borderRadius: 4, textDecoration: "none", fontSize: 12, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>FOR MEMBERS ›</a>
            </div>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <a href="/member-hub" style={{ border: "1px solid #ef4444", color: "#ef4444", padding: "6px 12px", borderRadius: 4, textDecoration: "none", fontSize: 10, fontFamily: "'Orbitron', sans-serif", letterSpacing: 1 }}>MEMBERS</a>
              <button onClick={() => setMenuOpen(o => !o)} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 6, display: "flex", flexDirection: "column", gap: 5 }} aria-label="Menu">
                <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? "#ef4444" : "#94a3b8", transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translate(5px,5px)" : "none" }} />
                <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? "transparent" : "#94a3b8", transition: "all 0.2s" }} />
                <span style={{ display: "block", width: 22, height: 2, background: menuOpen ? "#ef4444" : "#94a3b8", transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translate(5px,-5px)" : "none" }} />
              </button>
            </div>
          )}
        </div>
        {isMobile && menuOpen && (
          <div style={{ background: "rgba(13,17,23,0.98)", borderTop: "1px solid rgba(255,255,255,0.06)", padding: "8px 0 12px", animation: "menuSlide 0.2s ease" }}>
            {navItems.map(l => <a key={l} href={`#${l.toLowerCase().replace(/\s/g,"-")}`} onClick={() => setMenuOpen(false)} style={{ display: "block", padding: "13px 20px", color: "#94a3b8", textDecoration: "none", fontSize: 14, fontFamily: "'Share Tech Mono', monospace", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>{l}</a>)}
          </div>
        )}
      </nav>

      {/* HERO */}
      <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(180deg,rgba(8,10,15,1) 0%,rgba(13,17,23,0.85) 100%)", paddingTop: isMobile ? 130 : 70, position: "relative", overflow: "hidden" }}>
        <ParticleCanvas isMobile={isMobile} />
        <div style={{ position: "absolute", inset: 0, backgroundImage: "linear-gradient(rgba(239,68,68,0.04) 1px,transparent 1px),linear-gradient(90deg,rgba(239,68,68,0.04) 1px,transparent 1px)", backgroundSize: isMobile ? "40px 40px" : "60px 60px", pointerEvents: "none" }} />
        
          <div ref={heroParallaxRef} style={{ textAlign: "center", zIndex: 1, padding: isMobile ? "0 20px" : "0 24px", transform: isMobile ? "none" : "none" }}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: isMobile ? 9 : 11, color: "#64748b", letterSpacing: isMobile ? 2 : 3, marginBottom: 20 }}>FRC ROBOTICS · CHERRY CREEK HIGH SCHOOL · GREENWOOD VILLAGE, CO</div>
            <img src={logoUrl} alt="Team Logo" style={{ width: isMobile ? 88 : 110, height: isMobile ? 88 : 110, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(239,68,68,0.4)", boxShadow: "0 0 40px rgba(239,68,68,0.2)", marginBottom: isMobile ? 20 : 28, animation: "fadeUp 0.8s ease both" }} />
            <h1 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 900, fontSize: isMobile ? "clamp(22px,8vw,40px)" : "clamp(32px,6vw,72px)", letterSpacing: isMobile ? 2 : 4, color: "#f1f5f9",         animation: "fadeUp 0.8s ease 0.15s both, glitch 10s ease-in-out infinite" }}>SOMETHING'S BRUIN</h1>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: isMobile ? "clamp(16px,5vw,24px)" : "clamp(18px,3vw,32px)", color: "#ef4444", letterSpacing: isMobile ? 6 : 8, marginTop: 6,         animation: "fadeUp 0.8s ease 0.25s both, glitch 12s ease-in-out infinite 2s" }}>FRC TEAM 4550</div>
            <div style={{ width: 50, height: 2, background: "linear-gradient(90deg,transparent,#ef4444,transparent)", margin: isMobile ? "18px auto" : "24px auto", animation: "fadeUp 0.8s ease 0.35s both" }} />
            <p style={{ color: "#94a3b8", fontSize: isMobile ? 14 : 16, maxWidth: 420, margin: "0 auto", marginBottom: isMobile ? 28 : 36, lineHeight: 1.7, minHeight: isMobile ? 44 : 28, padding: "0 8px" }}>
              Engineering excellence. Community impact. Championship mindset.
            </p>
            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", animation: "fadeUp 0.8s ease 0.5s both" }}>
              <a href="#about" style={{ background: "#ef4444", color: "#fff", textDecoration: "none", padding: isMobile ? "12px 24px" : "14px 32px", borderRadius: 6, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: isMobile ? 11 : 13, letterSpacing: 2 }}>LEARN MORE</a>
              <a href={donate} target="_blank" rel="noreferrer" style={{ background: "transparent", color: "#ef4444", textDecoration: "none", padding: isMobile ? "12px 24px" : "14px 32px", borderRadius: 6, border: "1px solid #ef4444", fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: isMobile ? 11 : 13, letterSpacing: 2 }}>SUPPORT US</a>
            </div>
          </div>
        
      </section>

      {/* BANNERS / POSTERS */}
      {config.landing_banners_enabled !== "false" && banners.length > 0 && (
        <section style={{ background: "rgba(255,255,255,0.015)", padding: isMobile ? "48px 18px" : "64px 24px", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <motion.div style={{ maxWidth: 1100, width: "100%" }} {...slideUp}>
            <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: isMobile ? 10 : 12, color: "#ef4444", letterSpacing: isMobile ? 2 : 3, marginBottom: isMobile ? 16 : 24 }}>// BANNERS &amp; POSTERS</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: isMobile ? 16 : 24 }}>
              {banners.map((u, i) => (
                <div key={i} style={{ width: "100%", maxWidth: 900, borderRadius: 14, overflow: "hidden", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 6px 30px rgba(0,0,0,0.35)" }}>
                  <img src={u} alt="" style={{ width: "100%", height: "auto", display: "block", objectFit: "contain" }} onLoad={e => { const img = e.target; const w = img.naturalWidth, h = img.naturalHeight; if (h && w && w / h < 2) { img.parentElement.style.aspectRatio = "2/1"; img.style.height = "100%"; img.style.objectFit = "cover"; } }} onError={e => { e.target.parentElement.style.display = "none"; }} />
                </div>
              ))}
            </div>
          </motion.div>
        </section>
      )}

      {/* ABOUT */}
      <section id="about"><div className="sec">
        
          <ProgressSection>
            <Eyebrow>// WHO WE ARE</Eyebrow>
            <SectionTitle>About the Team</SectionTitle>
            <div className="about-grid">
              <div>
                <motion.div initial={{ opacity: 0, y: 50 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.1 }}>
                  <p style={{ color: "#94a3b8", lineHeight: 1.8, fontSize: 15, minHeight: "5em" }}>
                    <ScrollTypewriter text={`FRC Team 4550 "Something's Bruin" has been competing since 2012, representing Cherry Creek High School in FIRST Robotics Competition. Our team of 40–50 student engineers, programmers, and designers builds competition-ready robots each season — from scratch, in six weeks. We've competed at the 2016 World Championship and continue to push the boundaries of what student-built robots can achieve. Beyond the robot, we're deeply committed to STEM outreach and community impact across the Denver metro area.`} />
                  </p>
                </motion.div>
                <motion.div className="stats-grid" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                  {[{ num: "12+", label: "Years Competing" }, { num: "40–50", label: "Members" }, { num: "2016", label: "World Championship" }, { num: "3", label: "Sub-Teams" }].map((s, i) => (
                    <Card3D key={s.label}>
                      <motion.div variants={cardItem} whileHover={{ borderColor: "rgba(239,68,68,0.4)" }} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: isMobile ? "18px 14px" : "24px 20px", textAlign: "center" }}>
                        <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: isMobile ? 22 : 28, fontWeight: 700, color: "#ef4444" }}>{s.num}</div>
                        <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'Share Tech Mono', monospace", marginTop: 4 }}>{s.label}</div>
                      </motion.div>
                    </Card3D>
                  ))}
                  
                </motion.div>
              </div>
              {config.landing_img_1 && (
                <motion.div initial={{ opacity: 0, x: 40 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.2 }}>
                  <BlurredImage src={config.landing_img_1} style={{ width: "100%", aspectRatio: "4/3" }} />
                </motion.div>
              )}
            </div>
          </ProgressSection>
        
      </div></section>

      {/* OUR TEAM */}
      {captains.length > 0 && (
        <section id="team" style={{ background: "rgba(255,255,255,0.015)" }}><div className="sec">
          
            <ProgressSection>
              <Eyebrow>// LEADERSHIP</Eyebrow>
              <SectionTitle>Our Team</SectionTitle>
              <motion.div className="captains-grid" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                {captains.map((c, i) => (
                    <Card3D key={c.id}>
                    <motion.div variants={cardItem} whileHover={{ borderColor: "rgba(239,68,68,0.4)" }} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: isMobile ? "20px 14px" : "26px 20px", textAlign: "center" }}>
                    <CaptainPhoto photoUrl={c.photo_url} name={c.name} size={isMobile ? 70 : 88} style={{ display: "block", margin: "0 auto 12px", borderWidth: 2, borderStyle: "solid", borderColor: "rgba(239,68,68,0.4)" }} />
                    <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: isMobile ? 11 : 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 4 }}>{c.name}</div>
                    <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 10, color: "#ef4444", letterSpacing: 2, marginBottom: c.bio ? 8 : 0 }}>{c.position}</div>
                    {c.bio && <p style={{ color: "#64748b", fontSize: 12, lineHeight: 1.6 }}>{c.bio}</p>}
                  </motion.div>
                    </Card3D>
                ))}
              </motion.div>
            </ProgressSection>
          
        </div></section>
      )}

      {/* SUB-TEAMS */}
      <section id="sub-teams"><div className="sec">
        
          <ProgressSection>
            <Eyebrow>// HOW WE BUILD</Eyebrow>
            <SectionTitle>Sub-Teams</SectionTitle>
            <motion.div className="subteams-grid" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              {SUB_TEAMS.map((st, i) => (
                <Card3D key={st.name}>
                  <motion.div variants={cardItem} whileHover={{ borderTopColor: st.color }} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid rgba(255,255,255,0.08)`, borderTop: `3px solid ${st.color}`, borderRadius: 10, padding: isMobile ? "22px 18px" : "28px 24px", position: "relative" }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>{st.icon}</div>
                    <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 14, fontWeight: 700, color: "#f1f5f9", marginBottom: 12, letterSpacing: 1 }}>{st.name}</div>
                    <p style={{ color: "#94a3b8", lineHeight: 1.75, fontSize: 14 }}>{st.description}</p>
                    
                  </motion.div>
                </Card3D>
              ))}
            </motion.div>
          </ProgressSection>
        
      </div></section>

      {config.landing_img_2 && (
        <section style={{ padding: isMobile ? "0 0 40px" : "0 0 60px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
            <BlurredImage src={config.landing_img_2} style={{ width: "100%", aspectRatio: isMobile ? "16/9" : "21/9", borderRadius: 20 }} />
          </div>
        </section>
      )}

      {/* OUTREACH */}
      <section id="outreach" style={{ background: "rgba(255,255,255,0.015)" }}><div className="sec">
        
          <ProgressSection>
            <Eyebrow>// COMMUNITY</Eyebrow>
            <SectionTitle>Community Outreach</SectionTitle>
            <motion.div className="outreach-grid" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              {[
                { icon: "🤖", title: "Team Mentoring", desc: "We mentor younger FRC and FLL teams throughout the Denver metro area, sharing technical knowledge and competition experience." },
                { icon: "🏫", title: "School Outreach", desc: "Visiting local elementary and middle schools to inspire the next generation of engineers through hands-on robotics demos." },
                { icon: "🌍", title: "Community Events", desc: "Participating in local STEM fairs, library events, and community festivals to promote robotics and engineering education." },
              ].map((o, i) => (
                <Card3D key={o.title}>
                  <motion.div variants={cardItem} whileHover={{ borderColor: "rgba(34,197,94,0.4)" }} style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: isMobile ? "22px 18px" : "28px 24px", position: "relative" }}>
                    <div style={{ fontSize: 28, marginBottom: 10 }}>{o.icon}</div>
                    <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 10 }}>{o.title}</div>
                    <p style={{ color: "#94a3b8", lineHeight: 1.7, fontSize: 14 }}>{o.desc}</p>
                    
                  </motion.div>
                </Card3D>
              ))}
            </motion.div>
          </ProgressSection>
        
      </div></section>

      {/* MEDIA */}
      <section id="media-gallery"><div className="sec">
        
          <ProgressSection>
            <Eyebrow>// GALLERY</Eyebrow>
            <SectionTitle>Media Gallery</SectionTitle>
            <motion.p initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.15 }} style={{ color: "#94a3b8", maxWidth: 520, margin: "0 auto 28px", lineHeight: 1.8, fontSize: 15, textAlign: "center" }}>Browse photos and videos from competitions, outreach events, build season, and team activities.</motion.p>
            <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.25 }} style={{ textAlign: "center" }}>
              <a href="/media" style={{ display: "inline-block", background: "#ef4444", color: "#fff", textDecoration: "none", padding: isMobile ? "12px 28px" : "14px 36px", borderRadius: 6, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: isMobile ? 11 : 13, letterSpacing: 2 }}>EXPLORE GALLERY →</a>
            </motion.div>
          </ProgressSection>
        
      </div></section>

      {/* ARTICLES */}
      <section id="articles" style={{ background: "rgba(255,255,255,0.015)" }}><div className="sec">
        
          <ProgressSection>
            <Eyebrow>// LATEST</Eyebrow>
            <SectionTitle>Team Articles</SectionTitle>
            <motion.p initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.15 }} style={{ color: "#94a3b8", maxWidth: 560, margin: "0 auto 36px", lineHeight: 1.8, fontSize: 15, textAlign: "center" }}>Updates, stories, and insights from the team.</motion.p>
            <motion.div variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }} style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(280px,1fr))", gap: isMobile ? 16 : 20, maxWidth: 960, margin: "0 auto" }}>
              {articles.map((a, i) => (
                <motion.a key={a.id} href={"/article?id=" + a.id} variants={cardItem} whileHover={{ scale: 1.03, borderColor: "rgba(239,68,68,0.5)" }}
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden", textDecoration: "none", display: "flex", flexDirection: "column" }}>
                  {a.image_url && <div style={{ width: "100%", height: 160, background: `url(${a.image_url}) center/cover`, flexShrink: 0 }} />}
                  <div style={{ padding: "18px 20px", flex: 1, display: "flex", flexDirection: "column" }}>
                    <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'Share Tech Mono',monospace", marginBottom: 6 }}>
                      {new Date(a.created_at).toLocaleDateString()} {a.author && `· ${a.author}`}
                    </div>
                    <div style={{ fontFamily: "'Orbitron',sans-serif", fontSize: isMobile ? 12 : 13, fontWeight: 700, color: "#f1f5f9", marginBottom: 8, letterSpacing: 0.5, lineHeight: 1.4 }}>{a.title}</div>
                    {a.excerpt && <div style={{ fontSize: 12, color: "#94a3b8", lineHeight: 1.6, flex: 1 }}>{a.excerpt}</div>}
                  </div>
                </motion.a>
              ))}
            </motion.div>
            {articles.length === 0 && <div style={{ textAlign: "center", fontSize: 13, color: "#475569", fontFamily: "monospace" }}>No articles yet — check back soon.</div>}
          </ProgressSection>
        
      </div></section>

      {/* SOCIAL MEDIA */}
      <section id="media" style={{ background: "rgba(255,255,255,0.015)" }}><div className="sec">
        
          <ProgressSection>
            <Eyebrow>// FOLLOW ALONG</Eyebrow>
            <SectionTitle>Social Media</SectionTitle>
            <motion.div className="media-row" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
              {[
                { href: ig, icon: "📸", title: "Instagram", handle: "@cherrycreek.robotics", border: "rgba(59,130,246,0.3)" },
                { href: yt, icon: "▶️", title: "YouTube", handle: "Team 4550 Something's Bruin", border: "rgba(239,68,68,0.3)" },
              ].map((m, i) => (
                <motion.a key={m.title} href={m.href} target="_blank" rel="noreferrer" className="media-card" variants={cardItem} whileHover={{ scale: 1.05, borderColor: m.border.replace("0.3", "0.7") }} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${m.border}`, borderRadius: 10, padding: isMobile ? "24px 18px" : "32px 24px", textDecoration: "none", textAlign: "center", display: "block" }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>{m.icon}</div>
                  <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 15, fontWeight: 700, color: "#f1f5f9", marginBottom: 6 }}>{m.title}</div>
                  <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#64748b" }}>{m.handle}</div>
                </motion.a>
              ))}
            </motion.div>
          </ProgressSection>
        
      </div></section>

      {config.sponsor_bar_enabled !== "false" && (() => { try { const items = JSON.parse(config.sponsor_ribbon_items || "[]"); return <SponsorBar sponsors={items} isMobile={isMobile} />; } catch { return null; } })()}

      {/* SPONSORS */}
      <section id="sponsors" style={{ background: "rgba(255,255,255,0.015)" }}><div className="sec">
        
          <ProgressSection>
            <div style={{ textAlign: "center" }}>
              <Eyebrow>// PARTNER WITH US</Eyebrow>
              <SectionTitle>Become a Sponsor</SectionTitle>
              <motion.p initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.1 }} style={{ color: "#94a3b8", maxWidth: 560, margin: "0 auto 28px", lineHeight: 1.8, fontSize: 15 }}>Sponsoring FRC Team 4550 connects your organization with motivated young engineers and demonstrates your commitment to STEM education. Multiple sponsorship tiers are available with recognition at competitions, on our robot, and across our platforms.</motion.p>
              <motion.div className="tier-row" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                {[{ name: "Bronze", color: "#b45309" }, { name: "Silver", color: "#94a3b8" }, { name: "Gold", color: "#eab308" }, { name: "Platinum", color: "#818cf8" }].map((t, i) => (
                  <Card3D key={t.name}>
                    <motion.div variants={cardItem} whileHover={{ borderColor: t.color }} style={{ border: `1px solid ${t.color}`, borderRadius: 20, padding: isMobile ? "5px 14px" : "6px 20px", fontFamily: "'Orbitron', sans-serif", fontSize: isMobile ? 10 : 12, fontWeight: 700, letterSpacing: 2, color: t.color }}>{t.name}</motion.div>
                  </Card3D>
                ))}
                
              </motion.div>
              <motion.div initial={{ opacity: 0, scale: 0.9 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.35 }}>
                <a href={`mailto:${email}`} style={{ display: "inline-block", background: "#ef4444", color: "#fff", textDecoration: "none", padding: isMobile ? "12px 24px" : "14px 32px", borderRadius: 6, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: isMobile ? 11 : 13, letterSpacing: 2 }}>CONTACT US TO SPONSOR</a>
              </motion.div>
            </div>
          </ProgressSection>
        
      </div></section>

      {/* DONATE */}
      <section style={{ background: "rgba(239,68,68,0.05)", borderTop: "1px solid rgba(239,68,68,0.2)" }}><div className="sec">
        
          <ProgressSection>
            <div style={{ textAlign: "center" }}>
              <Eyebrow>// SUPPORT THE TEAM</Eyebrow>
              <SectionTitle>Make a Donation</SectionTitle>
              <motion.p initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 100, damping: 18, delay: 0.1 }} style={{ color: "#94a3b8", maxWidth: 460, margin: "0 auto 28px", lineHeight: 1.8, fontSize: 15 }}>Every donation goes directly toward robot parts, competition fees, and team travel. Help us compete at the highest level.</motion.p>
              <motion.div initial={{ opacity: 0, scale: 0.85 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true }} transition={{ type: "spring", stiffness: 140, damping: 14, delay: 0.25 }} style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
                <a href={donate} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: "#ef4444", color: "#fff", textDecoration: "none", padding: isMobile ? "12px 28px" : "14px 32px", borderRadius: 6, fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: isMobile ? 11 : 13, letterSpacing: 2 }}>DONATE NOW</a>
                
              </motion.div>
            </div>
          </ProgressSection>
        
      </div></section>

      {/* CONTACT */}
      <section id="contact"><div className="sec">
        
          <ProgressSection>
            <div style={{ textAlign: "center" }}>
              <Eyebrow>// GET IN TOUCH</Eyebrow>
              <SectionTitle>Contact</SectionTitle>
              <motion.div className="contact-row" variants={stagger} initial="hidden" whileInView="visible" viewport={{ once: true }}>
                {[{ href: `mailto:${email}`, icon: "✉️", label: email }, { href: ig, icon: "📸", label: "@cherrycreek.robotics" }].map((c, i) => (
                  <motion.a key={c.label} href={c.href} target="_blank" rel="noreferrer" variants={cardItem} whileHover={{ scale: 1.05, borderColor: "rgba(239,68,68,0.4)", color: "#ef4444" }} style={{ display: "flex", alignItems: "center", gap: 8, color: "#94a3b8", textDecoration: "none", fontSize: isMobile ? 13 : 15, fontFamily: "'Share Tech Mono', monospace", padding: isMobile ? "12px 20px" : 0, background: isMobile ? "rgba(255,255,255,0.04)" : "transparent", borderRadius: isMobile ? 8 : 0, border: isMobile ? "1px solid rgba(255,255,255,0.08)" : "none" }}>
                    <span style={{ fontSize: 18 }}>{c.icon}</span>{c.label}
                  </motion.a>
                ))}
                
              </motion.div>
            </div>
          </ProgressSection>
        
      </div></section>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid rgba(255,255,255,0.06)", padding: isMobile ? "32px 18px 20px" : "40px 32px 24px" }}>
        <div className="footer-top">
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <img src={logoUrl} alt="logo" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
            <div>
              <div style={{ fontFamily: "'Orbitron', sans-serif", fontSize: 13, fontWeight: 700, color: "#ef4444", animation: "glitch 20s ease-in-out infinite 3s" }}>SOMETHING'S BRUIN</div>
              <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'Share Tech Mono', monospace" }}>FRC Team 4550 · Cherry Creek High School</div>
            </div>
          </div>
          <div className="footer-links">
            {navItems.map(l => <a key={l} href={`#${l.toLowerCase().replace(/\s/g,"-")}`} style={{ color: "#64748b", textDecoration: "none", fontSize: 12, fontFamily: "'Share Tech Mono', monospace" }}>{l}</a>)}
          </div>
        </div>
        <div style={{ textAlign: "center", color: "#334155", fontSize: 11, fontFamily: "'Share Tech Mono', monospace", borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 18 }}>
          <a href="/privacy" style={{ color: "#475569", textDecoration: "none" }}>Privacy Policy</a>
          <span style={{ color: "#334155" }}> &middot; </span>
          <a href="/terms" style={{ color: "#475569", textDecoration: "none" }}>Terms &amp; Conditions</a>
          <div style={{ marginTop: 10 }}>
            &copy; {new Date().getFullYear()} FRC Team 4550 Something's Bruin &middot; Built by Palivela_Joel
          </div>
        </div>
      </footer>
    </div>
  );
}

function Eyebrow({ children }) {
  return <div style={{ fontFamily: "'Share Tech Mono', monospace", fontSize: 12, color: "#ef4444", letterSpacing: 3, marginBottom: 10, animation: "glitch 15s ease-in-out infinite" }}>{children}</div>;
}
function SectionTitle({ children }) {
  return <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontWeight: 700, fontSize: "clamp(20px,4vw,36px)", color: "#f1f5f9", marginBottom: 36, animation: "glitch 18s ease-in-out infinite 1s" }}>{children}</h2>;
}
