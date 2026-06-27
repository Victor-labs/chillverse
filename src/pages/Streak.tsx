import { ArrowLeft, Zap, Lock, Check, Flame } from "lucide-react";
import { useState, useEffect } from "react";
import { useProfile } from "../hooks/useProfile";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "../lib/supabase";
import { updateStreak } from "../lib/auth";
import { updateMissionProgress } from "../lib/weeklyMissions";

/* ═══════════════════════════════════════════════════
   MILESTONES
═══════════════════════════════════════════════════ */
const MILESTONES = [
  { days: 1,   xp: 10   },
  { days: 3,   xp: 30   },
  { days: 7,   xp: 100  },
  { days: 14,  xp: 200  },
  { days: 30,  xp: 400  },
  { days: 60,  xp: 800  },
  { days: 100, xp: 1600 },
  { days: 180, xp: 3200 },
  { days: 365, xp: 6400 },
];

/* ═══════════════════════════════════════════════════
   MOOD SYSTEM
═══════════════════════════════════════════════════ */
function getMood(streak: number): string {
  if (streak <= 0)  return "dead";
  if (streak < 3)   return "spark";
  if (streak < 7)   return "rising";
  if (streak < 30)  return "neutral";
  if (streak < 100) return "good";
  return "blazing";
}

const MOOD_META: Record<string, { label: string; sub: string; color: string; glow: string }> = {
  dead:    { label: "Flame's out",      sub: "Start today to relight it.",           color: "#555566", glow: "rgba(85,85,102,0.25)"   },
  spark:   { label: "Spark ignited",    sub: "Day 1 counts. Keep showing up.",       color: "#ff9a3c", glow: "rgba(255,154,60,0.35)"  },
  rising:  { label: "Rising up",        sub: "You're building momentum. Don't stop.",color: "#ff7a1a", glow: "rgba(255,122,26,0.38)"  },
  neutral: { label: "Steady",           sub: "You're building something real.",      color: "#ff6b00", glow: "rgba(255,107,0,0.4)"    },
  good:    { label: "On fire",          sub: "This streak has real heat now.",       color: "#ff4500", glow: "rgba(255,69,0,0.45)"    },
  blazing: { label: "Legendary",        sub: "Untouchable. Keep the halo lit.",      color: "#f5c542", glow: "rgba(245,197,66,0.45)"  },
};

/* ═══════════════════════════════════════════════════
   FACE
═══════════════════════════════════════════════════ */
function Face({ mood }: { mood: string }) {
  const eyeBase: React.CSSProperties = { position:"absolute", top:34, left:"50%", transform:"translateX(-50%)", display:"flex", gap:14, zIndex:3 };
  const mouthBase: React.CSSProperties = { position:"absolute", top:48, left:"50%", transform:"translateX(-50%)", width:18, height:9, zIndex:3 };

  if (mood === "dead") return (
    <>
      <div style={eyeBase}>
        <div style={{ width:7, height:2, borderRadius:2, background:"#1a1108", alignSelf:"center" }} />
        <div style={{ width:7, height:2, borderRadius:2, background:"#1a1108", alignSelf:"center" }} />
      </div>
      <svg style={mouthBase} viewBox="0 0 18 9"><path d="M2,3 Q9,0 16,3" stroke="#1a1108" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
    </>
  );
  if (mood === "spark") return (
    <>
      <div style={eyeBase}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:"#1a1108" }} />
        <div style={{ width:7, height:7, borderRadius:"50%", background:"#1a1108" }} />
      </div>
      <svg style={mouthBase} viewBox="0 0 18 9"><line x1="3" y1="3" x2="15" y2="3" stroke="#1a1108" strokeWidth="1.6" strokeLinecap="round" /></svg>
    </>
  );
  if (mood === "rising") return (
    <>
      <div style={eyeBase}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:"#1a1108" }} />
        <div style={{ width:7, height:7, borderRadius:"50%", background:"#1a1108" }} />
      </div>
      <svg style={mouthBase} viewBox="0 0 18 9"><path d="M2,4 Q9,8 16,4" stroke="#1a1108" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
    </>
  );
  if (mood === "neutral") return (
    <>
      <div style={eyeBase}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:"#1a1108" }} />
        <div style={{ width:7, height:7, borderRadius:"50%", background:"#1a1108" }} />
      </div>
      <svg style={mouthBase} viewBox="0 0 18 9"><line x1="3" y1="3" x2="15" y2="3" stroke="#1a1108" strokeWidth="1.6" strokeLinecap="round" /></svg>
    </>
  );
  if (mood === "good") return (
    <>
      <div style={eyeBase}>
        <div style={{ width:7, height:7, borderRadius:"50%", background:"#1a1108" }} />
        <div style={{ width:7, height:7, borderRadius:"50%", background:"#1a1108" }} />
      </div>
      <svg style={mouthBase} viewBox="0 0 18 9"><path d="M2,2 Q9,9 16,2" stroke="#1a1108" strokeWidth="1.8" fill="none" strokeLinecap="round" /></svg>
    </>
  );
  return (
    <>
      <div style={eyeBase}>
        <div style={{ width:6, height:6, borderRadius:"50%", background:"#1a1108" }} />
        <div style={{ width:6, height:6, borderRadius:"50%", background:"#1a1108" }} />
      </div>
      <svg style={mouthBase} viewBox="0 0 18 9"><path d="M1,1 Q9,11 17,1" stroke="#1a1108" strokeWidth="2" fill="none" strokeLinecap="round" /></svg>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   MASCOT
═══════════════════════════════════════════════════ */
function Mascot({ mood }: { mood: string }) {
  const meta = MOOD_META[mood];
  const flameColors: Record<string, { outer: string; inner: string }> = {
    dead:    { outer: "linear-gradient(180deg,#3a3a44,#26262e)", inner: "linear-gradient(180deg,#555566,#3a3a44)" },
    spark:   { outer: "linear-gradient(180deg,#ff9a3c,#cc5500)", inner: "linear-gradient(180deg,#ffc87a,#ff7a1a)" },
    rising:  { outer: "linear-gradient(180deg,#ff8a2a,#ff5500)", inner: "linear-gradient(180deg,#ffcc5a,#ff9a3c)" },
    neutral: { outer: "linear-gradient(180deg,#ff9a3c,#ff6b00)", inner: "linear-gradient(180deg,#ffd27a,#ff9a3c)" },
    good:    { outer: "linear-gradient(180deg,#ff8a1f,#ff6b00)", inner: "linear-gradient(180deg,#ffdd6b,#ffae3c)" },
    blazing: { outer: "linear-gradient(180deg,#ffdd6b,#ff6b00)", inner: "linear-gradient(180deg,#fff3c2,#ffd24a)" },
  };
  const fc = flameColors[mood];
  const scale = ({ dead:0.7, spark:0.88, rising:0.95, neutral:1, good:1.12, blazing:1.28 } as Record<string,number>)[mood];
  const flameAnim = mood === "dead" ? undefined : (mood === "spark" || mood === "rising") ? "flameFlicker 3.2s ease-in-out infinite" : mood === "neutral" ? "flameFlicker 3.2s ease-in-out infinite" : "flameBounce 2.4s ease-in-out infinite";

  return (
    <div style={{ position:"relative", width:200, height:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ position:"absolute", width:170, height:170, borderRadius:"50%", background:meta.glow, filter:"blur(36px)" }} />
      {mood === "blazing" && (
        <>
          <div style={{ position:"absolute", top:6, width:54, height:54, borderRadius:"50%", border:"3px solid #f5c542", boxShadow:"0 0 16px #f5c542,0 0 30px rgba(245,197,66,0.5)", animation:"haloFloat 2.6s ease-in-out infinite" }} />
          <div style={{ position:"absolute", top:78, left:18, width:34, height:46, background:"linear-gradient(135deg,rgba(255,255,255,0.9),rgba(245,197,66,0.5))", borderRadius:"50% 50% 50% 10%", transformOrigin:"right center", animation:"wingFlapL 1.4s ease-in-out infinite" }} />
          <div style={{ position:"absolute", top:78, right:18, width:34, height:46, background:"linear-gradient(135deg,rgba(255,255,255,0.9),rgba(245,197,66,0.5))", borderRadius:"50% 50% 10% 50%", transformOrigin:"left center", animation:"wingFlapR 1.4s ease-in-out infinite" }} />
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ position:"absolute", width:5, height:5, borderRadius:"50%", background:"#f5c542", boxShadow:"0 0 6px #f5c542", left:`${30+i*18}%`, bottom:"20%", animation:"sparkleDrift 2.8s ease-in-out infinite", animationDelay:`${i*0.45}s` }} />
          ))}
        </>
      )}
      <div style={{ position:"relative", width:88, height:106, zIndex:2, transform:`scale(${scale})`, animation: flameAnim }}>
        <div style={{ position:"absolute", inset:0, borderRadius:"50% 50% 50% 50% / 60% 60% 40% 40%", clipPath:"path('M44,104 C16,96 6,72 10,50 C13,32 26,18 36,4 C40,16 46,18 46,30 C54,18 60,4 60,4 C68,16 80,34 80,54 C80,76 68,98 44,104 Z')", background: fc.outer }} />
        <div style={{ position:"absolute", left:"50%", bottom:18, width:34, height:46, transform:"translateX(-50%)", borderRadius:"50% 50% 50% 50% / 60% 60% 40% 40%", opacity:0.85, background: fc.inner }} />
        <Face mood={mood} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════ */
interface StreakProps {
  onBack?: () => void;
}

export default function Streak({ onBack }: StreakProps) {
  const { profile, loading } = useProfile();
  const { user } = useAuth();
  const [liveStreak, setLiveStreak] = useState<number | null>(null);

  // On mount: run streak update then refetch the live value
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      await updateStreak(user.id);
      const { data } = await supabase
        .from("profiles")
        .select("streak")
        .eq("id", user.id)
        .single();
      if (data) {
        const currentStreak = data.streak ?? 0;
        setLiveStreak(currentStreak);
        // Weekly mission: streak_days — set progress to the actual streak count
        // We use the absolute value so the mission resolves correctly at 3/5/7
        if (currentStreak > 0) {
          updateMissionProgress(user.id, 'streak_days', currentStreak, true).catch(console.error);
        }
      }
    })();
  }, [user?.id]);

  // Subscribe to realtime changes on this user's profile streak
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`streak-live:${user.id}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "profiles",
        filter: `id=eq.${user.id}`,
      }, (payload) => {
        const updated = payload.new as { streak: number };
        if (typeof updated.streak === "number") setLiveStreak(updated.streak);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh", background:"var(--bg)" }}>
        <span style={{ width:36, height:36, borderRadius:"50%", border:"2px solid var(--surface3)", borderTopColor:"var(--accent)", display:"block", animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const streak = liveStreak ?? profile?.streak ?? 0;
  const mood = getMood(streak);
  const meta = MOOD_META[mood];
  const nextMilestone = MILESTONES.find(m => m.days > streak);

  return (
    <>
      <style>{`
        @keyframes spin         { to { transform: rotate(360deg); } }
        @keyframes flameBounce  { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-6px) scale(1.03)} }
        @keyframes flameFlicker { 0%,100%{transform:translateY(0) scaleY(1)} 45%{transform:translateY(1px) scaleY(0.97)} 55%{transform:translateY(-1px) scaleY(1.01)} }
        @keyframes flameDroop   { 0%,100%{transform:rotate(0deg) translateY(0)} 50%{transform:rotate(4deg) translateY(2px)} }
        @keyframes haloFloat    { 0%,100%{transform:translateY(0) rotate(-3deg)} 50%{transform:translateY(-4px) rotate(3deg)} }
        @keyframes wingFlapL    { 0%,100%{transform:rotate(-8deg) scaleX(1)} 50%{transform:rotate(14deg) scaleX(0.92)} }
        @keyframes wingFlapR    { 0%,100%{transform:rotate(8deg) scaleX(1)} 50%{transform:rotate(-14deg) scaleX(0.92)} }
        @keyframes sparkleDrift { 0%{opacity:0;transform:translateY(0) scale(0.5)} 30%{opacity:1} 100%{opacity:0;transform:translateY(-40px) scale(1)} }
        @keyframes feedIn       { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      <div style={{ minHeight:"100vh", background:"var(--bg)" }}>

        {/* Topbar */}
        <div style={{ position:"sticky", top:0, height:58, display:"flex", alignItems:"center", gap:14, padding:"0 20px", background:"rgba(17,17,19,0.90)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(255,255,255,0.05)", zIndex:50 }}>
          {onBack && (
            <button onClick={onBack} style={{ width:36, height:36, borderRadius:10, background:"var(--surface)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-dim)", boxShadow:"2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)" }}>
              <ArrowLeft size={15} />
            </button>
          )}
          <span style={{ fontSize:16, fontWeight:700, color:"var(--text)" }}>Streak</span>
        </div>

        {/* Mascot stage */}
        <div style={{ display:"flex", flexDirection:"column", alignItems:"center", padding:"36px 20px 28px" }}>
          <Mascot mood={mood} />
          <div style={{ fontSize:46, fontWeight:800, letterSpacing:-1, background:`linear-gradient(135deg,${meta.color},#fff)`, WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", marginTop:6 }}>
            {streak}
          </div>
          <div style={{ fontSize:13, color:"var(--text-dim)", fontWeight:600, marginTop:-4 }}>
            day{streak === 1 ? "" : "s"} streak
          </div>
          <div style={{ fontSize:15, fontWeight:700, color:meta.color, marginTop:10 }}>{meta.label}</div>
          <div style={{ fontSize:12, color:"var(--text-dim)", marginTop:3, textAlign:"center", maxWidth:240, lineHeight:1.5 }}>{meta.sub}</div>
        </div>

        {/* Milestones */}
        <div style={{ padding:"0 20px 32px" }}>
          <div style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:"1.2px", textTransform:"uppercase", marginBottom:14 }}>
            Milestones
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {MILESTONES.map((m, idx) => {
              const done = streak >= m.days;
              const isCurrentTarget = !done && m === nextMilestone;
              const prevDays = MILESTONES[idx - 1]?.days || 0;
              const progressPct = isCurrentTarget
                ? Math.min(100, Math.max(0, ((streak - prevDays) / (m.days - prevDays)) * 100))
                : done ? 100 : 0;

              return (
                <div
                  key={m.days}
                  style={{
                    display:"flex", alignItems:"center", gap:13,
                    background:"var(--surface)", borderRadius:16, padding:"13px 15px",
                    border: done
                      ? "1px solid rgba(62,207,142,0.3)"
                      : isCurrentTarget
                      ? "1px solid rgba(255,107,0,0.35)"
                      : "1px solid rgba(255,255,255,0.05)",
                    boxShadow: isCurrentTarget
                      ? "0 0 0 1px rgba(255,107,0,0.25),3px 3px 9px var(--neu-dark)"
                      : "3px 3px 9px var(--neu-dark),-2px -2px 7px var(--neu-light)",
                    position:"relative", overflow:"hidden",
                    animation:"feedIn 0.4s ease-out both",
                    animationDelay:`${idx * 0.04}s`,
                  }}
                >
                  <div style={{ width:38, height:38, borderRadius:12, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", background: done ? "rgba(62,207,142,0.15)" : "var(--surface2)", color: done ? "#3ecf8e" : "var(--text-muted)", boxShadow:"2px 2px 6px var(--neu-dark),-1px -1px 4px var(--neu-light)" }}>
                    {done ? <Check size={17} /> : <Flame size={17} />}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:13.5, fontWeight:700, color:"var(--text)" }}>{m.days}-day streak</div>
                    <div style={{ fontSize:11, color:"var(--text-dim)", marginTop:1, display:"flex", alignItems:"center", gap:4 }}>
                      <Zap size={11} color="#f5c542" /> +{m.xp.toLocaleString()} XP
                    </div>
                  </div>
                  {!done && !isCurrentTarget && <Lock size={14} color="var(--text-muted)" />}
                  <div style={{ position:"absolute", bottom:0, left:0, height:2, background:"var(--surface3)", width:"100%" }}>
                    <div style={{ height:"100%", background:"linear-gradient(90deg,var(--accent),#f5c542)", width:`${progressPct}%`, transition:"width 1s cubic-bezier(0.4,0,0.2,1)" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </>
  );
}
