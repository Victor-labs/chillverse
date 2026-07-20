import { ArrowLeft, Zap, Flame } from "lucide-react";
import { useState, useEffect } from "react";
import { useProfile } from "../profile/useProfile";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../../shared/lib/supabase";
import { updateStreak } from "../auth/auth";
import { updateMissionProgress } from "./weeklyMissions";
import furnaceMarker from "../../assets/streak-furnace.png";
import flameRed from "../../assets/streak-flame-red.png";
import flameBlue from "../../assets/streak-flame-blue.png";
import flameGreen from "../../assets/streak-flame-green.png";
import flamePurple from "../../assets/streak-flame-purple.png";

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

const MOOD_META: Record<string, { label: string; sub: string; color: string }> = {
  dead:    { label: "Flame's out",   sub: "Start today to relight it.",            color: "var(--text-muted)" },
  spark:   { label: "Spark ignited", sub: "Day 1 counts. Keep showing up.",         color: "var(--accent2)" },
  rising:  { label: "Rising up",     sub: "You're building momentum. Don't stop.",  color: "var(--accent)" },
  neutral: { label: "Steady",        sub: "You're building something real.",       color: "var(--accent)" },
  good:    { label: "On fire",       sub: "This streak has real heat now.",        color: "#ff4500" },
  blazing: { label: "Legendary",     sub: "Untouchable. Keep the halo lit.",        color: "var(--gold)" },
};

/* ═══════════════════════════════════════════════════
   FLAME COLOR TIERS — the mascot's flame shifts color
   as the streak grows, getting "hotter": red → blue →
   green → purple. Thresholds line up with the existing
   milestone breakpoints (7 / 30 / 100 days) so the color
   change and the milestone track advance together.
═══════════════════════════════════════════════════ */
type FlameTier = "red" | "blue" | "green" | "purple";

const FLAME_TIER_META: Record<FlameTier, { src: string; glow: string }> = {
  red:    { src: flameRed,    glow: "#ff5a36" },
  blue:   { src: flameBlue,   glow: "#3b82f6" },
  green:  { src: flameGreen,  glow: "#22c55e" },
  purple: { src: flamePurple, glow: "#a855f7" },
};

function getFlameTier(streak: number): FlameTier {
  if (streak < 7)   return "red";
  if (streak < 30)  return "blue";
  if (streak < 100) return "green";
  return "purple";
}

/* ═══════════════════════════════════════════════════
   WEEKLY DOTS — derived from streak length + last check-in date
   (no per-day history is stored, so a day is inferred "lit" if it
   falls within the unbroken run ending on last_streak_date)
═══════════════════════════════════════════════════ */
const WEEKDAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

function parseDateOnly(s: string | null | undefined): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfWeekMonday(d: Date): Date {
  const day = d.getDay(); // 0 = Sun .. 6 = Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function diffDays(a: Date, b: Date): number {
  const MS = 24 * 60 * 60 * 1000;
  return Math.round((a.getTime() - b.getTime()) / MS);
}

interface WeekDot { key: number; label: string; lit: boolean; isToday: boolean }

function getWeekDots(streak: number, lastStreakDate: string | null | undefined): WeekDot[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const lastDate = parseDateOnly(lastStreakDate);
  const monday = startOfWeekMonday(today);

  return WEEKDAY_LABELS.map((label, i) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    const isToday = diffDays(date, today) === 0;
    const isFuture = date.getTime() > today.getTime();
    let lit = false;
    if (!isFuture && lastDate && streak > 0) {
      const daysBeforeLast = diffDays(lastDate, date);
      lit = daysBeforeLast >= 0 && daysBeforeLast < streak;
    }
    return { key: i, label, lit, isToday };
  });
}

/* ═══════════════════════════════════════════════════
   MASCOT — ember flame, always at full vividness
═══════════════════════════════════════════════════ */
const EMBER_PARTICLES = [
  { left: "38%", delay: "0.1s", drift: "12px",  size: 4 },
  { left: "58%", delay: "1.1s", drift: "-14px", size: 3 },
  { left: "46%", delay: "2.0s", drift: "6px",   size: 4 },
  { left: "64%", delay: "0.7s", drift: "-8px",  size: 3 },
  { left: "41%", delay: "1.7s", drift: "16px",  size: 2 },
];

function Mascot({ mood, streak }: { mood: string; streak: number }) {
  const meta = MOOD_META[mood];
  const tier = getFlameTier(streak);
  const flame = FLAME_TIER_META[tier];

  return (
    <div style={{ position:"relative", width:200, height:190, display:"flex", alignItems:"flex-end", justifyContent:"center", margin:"0 auto" }}>
      {/* ambient pulsing glow behind the flame — tinted to the current flame tier */}
      <div style={{ position:"absolute", bottom:16, width:150, height:150, borderRadius:"50%", background:`radial-gradient(circle, color-mix(in srgb, ${flame.glow} 45%, transparent) 0%, transparent 70%)`, filter:"blur(4px)", animation:"emberPulse 2.1s ease-in-out infinite", transition:"background 0.6s ease" }} />

      {/* rising embers — tinted to the current flame tier */}
      <div style={{ position:"absolute", inset:0, pointerEvents:"none" }}>
        {EMBER_PARTICLES.map((p, i) => (
          <span
            key={i}
            style={{
              position:"absolute", bottom:36, left:p.left, width:p.size, height:p.size, borderRadius:"50%",
              background: flame.glow, boxShadow:`0 0 6px 1px ${flame.glow}`, opacity:0,
              animation:"emberRise 3.2s ease-in infinite", animationDelay:p.delay,
              ['--drift' as unknown as string]: p.drift,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {mood === "blazing" && (
        <>
          <div style={{ position:"absolute", top:6, left:"50%", transform:"translateX(-50%)", width:54, height:54, borderRadius:"50%", border:"3px solid var(--gold)", boxShadow:"0 0 16px var(--gold),0 0 30px rgba(245,197,66,0.5)", animation:"haloFloat 2.6s ease-in-out infinite" }} />
          <div style={{ position:"absolute", top:78, left:"calc(50% - 52px)", width:34, height:46, background:"linear-gradient(135deg,rgba(255,255,255,0.9),rgba(245,197,66,0.5))", borderRadius:"50% 50% 50% 10%", transformOrigin:"right center", animation:"wingFlapL 1.4s ease-in-out infinite" }} />
          <div style={{ position:"absolute", top:78, left:"calc(50% + 18px)", width:34, height:46, background:"linear-gradient(135deg,rgba(255,255,255,0.9),rgba(245,197,66,0.5))", borderRadius:"50% 50% 10% 50%", transformOrigin:"left center", animation:"wingFlapR 1.4s ease-in-out infinite" }} />
          {[...Array(5)].map((_, i) => (
            <div key={i} style={{ position:"absolute", width:5, height:5, borderRadius:"50%", background:"var(--gold)", boxShadow:"0 0 6px var(--gold)", left:`${30+i*18}%`, bottom:"30%", animation:"sparkleDrift 2.8s ease-in-out infinite", animationDelay:`${i*0.45}s` }} />
          ))}
        </>
      )}

      <img
        key={tier}
        src={flame.src}
        alt={`${meta.label} — ${streak} day streak (${tier} flame)`}
        style={{
          position: "relative",
          zIndex: 2,
          width: 128,
          height: 128,
          objectFit: "contain",
          filter: `drop-shadow(0 12px 20px color-mix(in srgb, ${flame.glow} 55%, transparent)) brightness(1.08) saturate(1.2)`,
          animation: "emberFlicker 2.6s ease-in-out infinite, flameFadeIn 0.5s ease-out",
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   WEEK ROW — M T W T F S S, lit per inferred check-in
═══════════════════════════════════════════════════ */
function WeekRow({ streak, lastStreakDate }: { streak: number; lastStreakDate: string | null | undefined }) {
  const dots = getWeekDots(streak, lastStreakDate);
  return (
    <div style={{ display:"flex", justifyContent:"space-between", paddingTop:14, marginTop:6, borderTop:"1px solid rgba(255,255,255,0.06)", position:"relative", zIndex:2 }}>
      {dots.map(d => (
        <div key={d.key} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:7 }}>
          <span style={{ fontSize:10, fontWeight:600, letterSpacing:".05em", color:"var(--text-muted)" }}>{d.label}</span>
          <span
            style={{
              width:18, height:18, borderRadius:"50%",
              border: d.lit ? "none" : "1.5px solid var(--surface3)",
              background: d.lit ? "radial-gradient(circle at 35% 30%, var(--gold), var(--accent) 70%)" : "var(--surface2)",
              boxShadow: d.lit ? "0 0 9px 1px color-mix(in srgb, var(--accent) 55%, transparent)" : "inset 2px 2px 5px var(--neu-dark)",
              outline: d.isToday ? "2px solid var(--gold)" : "none",
              outlineOffset: 2,
              animation: d.isToday ? "todayPulse 1.8s ease-in-out infinite" : undefined,
            }}
          />
        </div>
      ))}
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
  const [liveLongest, setLiveLongest] = useState<number | null>(null);
  const [liveLastDate, setLiveLastDate] = useState<string | null | undefined>(undefined);

  // On mount: run streak update then refetch the live value
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      await updateStreak(user.id);
      const { data } = await supabase
        .from("profiles")
        .select("streak, longest_streak, last_streak_date")
        .eq("id", user.id)
        .single();
      if (data) {
        const currentStreak = data.streak ?? 0;
        setLiveStreak(currentStreak);
        setLiveLongest(data.longest_streak ?? 0);
        setLiveLastDate(data.last_streak_date ?? null);
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
        const updated = payload.new as { streak: number; longest_streak: number; last_streak_date: string | null };
        if (typeof updated.streak === "number") setLiveStreak(updated.streak);
        if (typeof updated.longest_streak === "number") setLiveLongest(updated.longest_streak);
        if (updated.last_streak_date !== undefined) setLiveLastDate(updated.last_streak_date);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  if (loading) {
    return (
      <div style={{ display:"flex", alignItems:"center", justifyContent:"center", minHeight:"100vh" }}>
        <span style={{ width:36, height:36, borderRadius:"50%", border:"2px solid var(--surface3)", borderTopColor:"var(--accent)", display:"block", animation:"spin 0.8s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  const streak = liveStreak ?? profile?.streak ?? 0;
  const longestStreak = Math.max(liveLongest ?? profile?.longest_streak ?? 0, streak);
  const lastStreakDate = liveLastDate !== undefined ? liveLastDate : profile?.last_streak_date;
  const mood = getMood(streak);
  const meta = MOOD_META[mood];
  const flameTier = getFlameTier(streak);
  const flameGlow = FLAME_TIER_META[flameTier].glow;

  // ── Furnace track: 9 milestones mapped onto evenly-spaced flags,
  // with the marker position interpolated within whichever milestone
  // "leg" the current streak falls into.
  const breakpoints = [0, ...MILESTONES.map(m => m.days)];
  const legCount = breakpoints.length - 1;
  let leg = 0;
  while (leg < legCount && streak >= breakpoints[leg + 1]) leg++;
  leg = Math.min(leg, legCount - 1);
  const legStart = breakpoints[leg];
  const legEnd = breakpoints[leg + 1];
  const legFrac = legEnd > legStart ? Math.min(1, Math.max(0, (streak - legStart) / (legEnd - legStart))) : 1;
  const trackPct = ((leg + legFrac) / legCount) * 100;

  const nextMilestone = MILESTONES.find(m => streak < m.days);
  const daysToNext = nextMilestone ? nextMilestone.days - streak : 0;
  const reachedCount = MILESTONES.filter(m => streak >= m.days).length;

  return (
    <>
      <style>{`
        @keyframes spin         { to { transform: rotate(360deg); } }
        @keyframes emberPulse   { 0%,100%{opacity:.55; transform:scale(0.92);} 50%{opacity:1; transform:scale(1.1);} }
        @keyframes emberFlicker { 0%,100%{transform:scale(1) rotate(0deg) skewX(0deg);} 20%{transform:scale(1.02,0.985) rotate(-1deg) skewX(-1deg);} 45%{transform:scale(0.98,1.03) rotate(1.2deg) skewX(1deg);} 65%{transform:scale(1.03,0.97) rotate(-0.6deg) skewX(-0.5deg);} 85%{transform:scale(0.99,1.01) rotate(0.8deg) skewX(0.6deg);} }
        @keyframes flameFadeIn  { 0%{opacity:0; transform:scale(0.85);} 100%{opacity:1; transform:scale(1);} }
        @keyframes emberRise    { 0%{opacity:0; transform:translate(0,0) scale(1);} 12%{opacity:1;} 80%{opacity:.5;} 100%{opacity:0; transform:translate(var(--drift,10px), -120px) scale(.3);} }
        @keyframes haloFloat    { 0%,100%{transform:translateX(-50%) translateY(0) rotate(-3deg)} 50%{transform:translateX(-50%) translateY(-4px) rotate(3deg)} }
        @keyframes wingFlapL    { 0%,100%{transform:rotate(-8deg) scaleX(1)} 50%{transform:rotate(14deg) scaleX(0.92)} }
        @keyframes wingFlapR    { 0%,100%{transform:rotate(8deg) scaleX(1)} 50%{transform:rotate(-14deg) scaleX(0.92)} }
        @keyframes sparkleDrift { 0%{opacity:0;transform:translateY(0) scale(0.5)} 30%{opacity:1} 100%{opacity:0;transform:translateY(-40px) scale(1)} }
        @keyframes todayPulse   { 0%,100%{ box-shadow:0 0 0 3px rgba(245,197,66,0.18); } 50%{ box-shadow:0 0 0 6px rgba(245,197,66,0.04); } }
        @keyframes trackSheen   { 0%{transform:translateX(-100%);} 100%{transform:translateX(340%);} }
        @keyframes markerBob    { 0%,100%{transform:translateY(0) rotate(0deg);} 50%{transform:translateY(-4px) rotate(3deg);} }
      `}</style>

      <div style={{ minHeight:"100vh" }}>

        {/* Topbar */}
        <div style={{ position:"sticky", top:0, height:58, display:"flex", alignItems:"center", gap:14, padding:"0 20px", background:"rgba(17,17,19,0.90)", backdropFilter:"blur(16px)", borderBottom:"1px solid rgba(255,255,255,0.05)", zIndex:50 }}>
          {onBack && (
            <button onClick={onBack} style={{ width:36, height:36, borderRadius:10, background:"var(--surface)", border:"none", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", color:"var(--text-dim)", boxShadow:"var(--elev-raise-sm)" }}>
              <ArrowLeft size={15} />
            </button>
          )}
          <span style={{ fontSize:16, fontWeight:700, color:"var(--text)" }}>Streak</span>
        </div>

        <div style={{ padding:"20px 20px 32px", display:"flex", flexDirection:"column", gap:18 }}>

          {/* ── Ember hero card ── */}
          <div style={{ position:"relative", borderRadius:24, background:"var(--surface)", boxShadow:"var(--elev-raise)", border:"1px solid rgba(255,255,255,0.04)", padding:"26px 22px 22px", overflow:"hidden" }}>
            {/* breathing ambient glow */}
            <div style={{ position:"absolute", top:"-34%", left:"50%", width:280, height:280, transform:"translateX(-50%)", background:"radial-gradient(circle, color-mix(in srgb, var(--accent) 40%, transparent) 0%, transparent 68%)", filter:"blur(8px)", animation:"emberPulse 3.4s ease-in-out infinite", pointerEvents:"none" }} />

            <div style={{ position:"relative", zIndex:2, display:"flex", alignItems:"flex-start", justifyContent:"space-between" }}>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:"1.2px", textTransform:"uppercase" }}>Current Streak</span>
              <span style={{ display:"flex", alignItems:"center", gap:6, fontSize:10.5, fontWeight:700, color:meta.color, background:"var(--surface2)", border:`1px solid ${meta.color}`, padding:"5px 10px 5px 8px", borderRadius:999, boxShadow:"var(--elev-raise-sm)" }}>
                <Flame size={11} color={meta.color} /> {meta.label.toUpperCase()}
              </span>
            </div>

            <div style={{ position:"relative", zIndex:2 }}>
              <Mascot mood={mood} streak={streak} />
            </div>

            <div style={{ position:"relative", zIndex:2, textAlign:"center", marginTop:2 }}>
              <div style={{ display:"flex", alignItems:"baseline", justifyContent:"center", gap:8 }}>
                <span style={{ fontSize:48, fontWeight:800, letterSpacing:-1, color:"var(--text)" }}>{streak}</span>
                <span style={{ fontSize:14, fontWeight:600, color:"var(--text-dim)" }}>day{streak === 1 ? "" : "s"}</span>
              </div>
              <div style={{ fontSize:12.5, color:"var(--text-dim)", marginTop:6 }}>
                Longest run: <strong style={{ color:"var(--gold)", fontWeight:700 }}>{longestStreak} day{longestStreak === 1 ? "" : "s"}</strong>
              </div>
              <div style={{ fontSize:12, color:"var(--text-dim)", marginTop:10, maxWidth:260, marginLeft:"auto", marginRight:"auto", lineHeight:1.5 }}>{meta.sub}</div>
            </div>

            <WeekRow streak={streak} lastStreakDate={lastStreakDate} />
          </div>

          {/* ── Furnace milestone track ── */}
          <div style={{ position:"relative", borderRadius:24, background:"var(--surface)", boxShadow:"var(--elev-raise)", border:"1px solid rgba(255,255,255,0.04)", padding:"24px 22px 20px" }}>
            <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:20 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"var(--text-muted)", letterSpacing:"1.2px", textTransform:"uppercase" }}>Milestones</span>
              <span style={{ fontSize:11.5, color:"var(--text-dim)" }}>{reachedCount}/{MILESTONES.length} reached</span>
            </div>

            <div style={{ position:"relative", height:60, margin:"6px 8px 4px" }}>
              {/* track */}
              <div style={{ position:"absolute", top:"50%", left:0, right:0, height:6, transform:"translateY(-50%)", background:"var(--surface2)", borderRadius:6, overflow:"hidden", boxShadow:"var(--elev-inset)" }}>
                <div style={{ position:"relative", left:0, top:0, bottom:0, height:"100%", width:`${trackPct}%`, borderRadius:6, background:"linear-gradient(90deg, var(--accent), var(--accent2) 55%, var(--gold))", boxShadow:"0 0 12px 1px color-mix(in srgb, var(--accent) 55%, transparent)", transition:"width 1s cubic-bezier(0.4,0,0.2,1)", overflow:"hidden" }}>
                  <div style={{ position:"absolute", inset:0, width:"40%", background:"linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)", animation:"trackSheen 2.6s ease-in-out infinite" }} />
                </div>
              </div>

              {/* flags */}
              {MILESTONES.map((m, i) => {
                const flagPct = ((i + 1) / legCount) * 100;
                const reached = streak >= m.days;
                const showLabel = reached || m === nextMilestone;
                return (
                  <div key={m.days} style={{ position:"absolute", top:"50%", left:`${flagPct}%`, transform:"translate(-50%,-50%)" }}>
                    <div style={{ width:11, height:11, borderRadius:"50%", background: reached ? "var(--gold)" : "var(--bg)", border:`2px solid ${reached ? "var(--gold)" : "var(--text-muted)"}`, boxShadow: reached ? "0 0 6px 1px rgba(245,197,66,0.6)" : "none" }} />
                    {showLabel && (
                      <span style={{ position:"absolute", top:16, left:"50%", transform:"translateX(-50%)", fontSize:9.5, fontWeight:600, color: reached ? "var(--gold)" : "var(--text-dim)", whiteSpace:"nowrap" }}>{m.days}d</span>
                    )}
                  </div>
                );
              })}

              {/* marker */}
              <div style={{ position:"absolute", top:"50%", left:`${trackPct}%`, transform:"translate(-50%,-50%)" }}>
                <div style={{ position:"absolute", top:"50%", left:"50%", width:44, height:44, transform:"translate(-50%,-50%)", background:`radial-gradient(circle, color-mix(in srgb, ${flameGlow} 55%, transparent) 0%, transparent 70%)`, filter:"blur(3px)", animation:"emberPulse 2s ease-in-out infinite", transition:"background 0.6s ease" }} />
                <img src={furnaceMarker} alt="Current position" style={{ position:"relative", width:32, height:32, zIndex:2, filter:`drop-shadow(0 6px 8px color-mix(in srgb, ${flameGlow} 50%, transparent))`, animation:"markerBob 2.4s ease-in-out infinite" }} />
              </div>
            </div>

            <div style={{ marginTop:20, paddingTop:14, borderTop:"1px solid rgba(255,255,255,0.06)", fontSize:12.5, color:"var(--text-dim)", display:"flex", alignItems:"center", gap:6 }}>
              {nextMilestone ? (
                <>
                  <Zap size={12} color="var(--gold)" />
                  <span><strong style={{ color:"var(--text)" }}>{daysToNext} day{daysToNext === 1 ? "" : "s"}</strong> to next milestone — +{nextMilestone.xp.toLocaleString()} XP</span>
                </>
              ) : (
                <>
                  <Flame size={12} color="var(--gold)" />
                  <span>All milestones reached — <strong style={{ color:"var(--gold)" }}>legendary streak.</strong></span>
                </>
              )}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
