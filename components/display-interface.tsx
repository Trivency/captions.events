"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { HEX_COLOR } from "@/lib/event-theme";

interface Event {
  id: string;
  uid: string;
  title: string;
}

interface Caption {
  id: string;
  text: string;
  timestamp: string;
  is_final: boolean;
  language_code?: string;
}

interface DisplayInterfaceProps {
  event: Event;
  /** Raw query params from the page; parsed here so the same code handles URL, storage and UI */
  initialQuery: Record<string, string | undefined>;
  /** Seed captions (used by previews/tests); live captions are appended after these */
  initialCaptions?: Caption[];
}

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

type Position = "bottom" | "top";
type Align = "left" | "center";
type Font = "sans" | "serif" | "mono" | "condensed";

export interface DisplaySettings {
  /** visible text lines inside the band */
  lines: number;
  /** font size in vw */
  size: number;
  font: Font;
  /** screen (key) color behind the band */
  key: string;
  /** band color */
  band: string;
  /** band opacity 0–1 */
  bandAlpha: number;
  /** text color */
  fg: string;
  pos: Position;
  align: Align;
  caps: boolean;
  /** horizontal safe margin, vw */
  margin: number;
  outline: boolean;
  /** show the tiny connection dot */
  status: boolean;
}

const DEFAULTS: DisplaySettings = {
  lines: 2,
  size: 4,
  font: "sans",
  key: "#000000",
  band: "#000000",
  bandAlpha: 1,
  fg: "#ffffff",
  pos: "bottom",
  align: "left",
  caps: false,
  margin: 4,
  outline: false,
  status: true,
};

const KEY_PRESETS: { label: string; value: string }[] = [
  { label: "Black", value: "#000000" },
  { label: "Green", value: "#00ff00" },
  { label: "Blue", value: "#0000ff" },
  { label: "Magenta", value: "#ff00ff" },
];

const FONT_STACKS: Record<Font, string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  condensed:
    "'Arial Narrow', 'Helvetica Neue Condensed', 'Roboto Condensed', Impact, sans-serif",
};

// Accept hex or a short CSS color name; anything else is ignored
function color(v: string | undefined, fallback: string) {
  if (!v) return fallback;
  if (HEX_COLOR.test(v)) return v;
  if (/^[a-zA-Z]{3,20}$/.test(v)) return v;
  return fallback;
}
function num(v: string | undefined, fallback: number, min: number, max: number) {
  const n = Number.parseFloat(v ?? "");
  if (Number.isNaN(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
function bool(v: string | undefined, fallback: boolean) {
  if (v === undefined) return fallback;
  return v === "1" || v === "true";
}
function oneOf<T extends string>(v: string | undefined, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(v ?? "") ? (v as T) : fallback;
}

function parseSettings(
  q: Record<string, string | undefined>,
  base: DisplaySettings
): DisplaySettings {
  return {
    lines: Math.round(num(q.lines, base.lines, 1, 8)),
    size: num(q.size, base.size, 1.5, 12),
    font: oneOf(q.font, ["sans", "serif", "mono", "condensed"] as const, base.font),
    key: color(q.key ?? q.bg, base.key),
    band: color(q.band, base.band),
    bandAlpha: num(q.alpha, base.bandAlpha, 0, 1),
    fg: color(q.fg, base.fg),
    pos: oneOf(q.pos, ["bottom", "top"] as const, base.pos),
    align: oneOf(q.align, ["left", "center"] as const, base.align),
    caps: bool(q.caps, base.caps),
    margin: num(q.margin, base.margin, 0, 20),
    outline: bool(q.outline, base.outline),
    status: bool(q.status, base.status),
  };
}

function toQuery(s: DisplaySettings): string {
  const p = new URLSearchParams();
  (Object.keys(DEFAULTS) as (keyof DisplaySettings)[]).forEach((k) => {
    if (s[k] === DEFAULTS[k]) return;
    const key = k === "bandAlpha" ? "alpha" : k;
    const v = s[k];
    p.set(key, typeof v === "boolean" ? (v ? "1" : "0") : String(v));
  });
  return p.toString();
}

function hexToRgba(hex: string, alpha: number) {
  if (!HEX_COLOR.test(hex)) return hex; // named color: alpha ignored
  let h = hex.slice(1);
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */

const LINE_HEIGHT = 1.25;
const MAX_SEGMENTS = 60;

export function DisplayInterface({
  event,
  initialQuery,
  initialCaptions = [],
}: DisplayInterfaceProps) {
  const storageKey = `display:${event.uid}`;

  // URL params win over saved settings, which win over defaults
  const [settings, setSettings] = useState<DisplaySettings>(() =>
    parseSettings(initialQuery, DEFAULTS)
  );
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    let saved: DisplaySettings = DEFAULTS;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) saved = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      /* ignore */
    }
    setSettings(parseSettings(initialQuery, saved));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist + reflect in URL so the current look can be bookmarked or copied
  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
    const qs = toQuery(settings);
    const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", url);
  }, [settings, hydrated, storageKey]);

  const update = useCallback(
    (patch: Partial<DisplaySettings>) => setSettings((s) => ({ ...s, ...patch })),
    []
  );

  /* ---------------- captions ---------------- */
  const [captions, setCaptions] = useState<Caption[]>(initialCaptions);
  const [partialText, setPartialText] = useState("");
  const [connected, setConnected] = useState(false);
  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    const loadCaptions = async () => {
      const { data, error } = await supabase
        .from("captions")
        .select("*")
        .eq("event_id", event.id)
        .eq("is_final", true)
        .order("sequence_number", { ascending: false })
        .limit(MAX_SEGMENTS);
      if (error) {
        console.error("Error loading captions:", error);
      } else if (data && data.length) {
        setCaptions([...data].reverse());
      }
    };
    loadCaptions();
  }, [event.id, supabase]);

  useEffect(() => {
    const channel = supabase
      .channel(`captions:${event.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "captions",
          filter: `event_id=eq.${event.id}`,
        },
        (payload: { new: Caption }) => {
          setPartialText("");
          setCaptions((prev) => {
            if (prev.some((c) => c.id === payload.new.id)) return prev;
            return [...prev, payload.new].slice(-MAX_SEGMENTS);
          });
        }
      )
      .subscribe((status: string) => setConnected(status === "SUBSCRIBED"));
    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id, supabase]);

  useEffect(() => {
    const broadcastChannel = supabase
      .channel(`broadcast:${event.uid}`)
      .on(
        "broadcast",
        { event: "partial_transcript" },
        (payload: { payload: { text: string } }) => setPartialText(payload.payload.text)
      )
      .subscribe();
    return () => {
      supabase.removeChannel(broadcastChannel);
    };
  }, [event.uid, supabase]);

  /* ---------------- UI chrome (panel, cursor, hotkeys) ---------------- */
  const [panelOpen, setPanelOpen] = useState(false);
  const [chromeVisible, setChromeVisible] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const poke = useCallback(() => {
    setChromeVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setChromeVisible(false), 2500);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && ["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName)) return;
      switch (e.key) {
        case "s":
        case "S":
          setPanelOpen((o) => !o);
          break;
        case "f":
        case "F":
          toggleFullscreen();
          break;
        case "+":
        case "=":
          setSettings((s) => ({ ...s, size: Math.min(12, +(s.size + 0.25).toFixed(2)) }));
          break;
        case "-":
        case "_":
          setSettings((s) => ({ ...s, size: Math.max(1.5, +(s.size - 0.25).toFixed(2)) }));
          break;
        case "]":
          setSettings((s) => ({ ...s, lines: Math.min(8, s.lines + 1) }));
          break;
        case "[":
          setSettings((s) => ({ ...s, lines: Math.max(1, s.lines - 1) }));
          break;
        case "Escape":
          setPanelOpen(false);
          break;
        default:
          return;
      }
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleFullscreen]);

  const [copied, setCopied] = useState(false);
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  /* ---------------- derived styles ---------------- */
  const bandStyle = useMemo(() => {
    const textPx = `${settings.size}vw`;
    return {
      background: hexToRgba(settings.band, settings.bandAlpha),
      color: settings.fg,
      fontFamily: FONT_STACKS[settings.font],
      fontSize: textPx,
      lineHeight: LINE_HEIGHT,
      paddingLeft: `${settings.margin}vw`,
      paddingRight: `${settings.margin}vw`,
      textAlign: settings.align,
      textTransform: settings.caps ? ("uppercase" as const) : ("none" as const),
      textShadow: settings.outline
        ? "0 0 0.06em #000, 0 0 0.06em #000, 0.04em 0.04em 0 #000, -0.04em -0.04em 0 #000, 0.04em -0.04em 0 #000, -0.04em 0.04em 0 #000"
        : "none",
    };
  }, [settings]);

  const textAreaHeight = `calc(${settings.lines} * ${settings.size}vw * ${LINE_HEIGHT})`;

  return (
    <div
      className="fixed inset-0 overflow-hidden select-none"
      style={{
        background: settings.key,
        cursor: chromeVisible || panelOpen ? "default" : "none",
      }}
      onMouseMove={poke}
      onClick={() => !panelOpen && poke()}
    >
      {/* Caption band */}
      <div
        className="absolute left-0 right-0 font-semibold"
        style={{
          ...bandStyle,
          [settings.pos]: 0,
          paddingTop: "0.5em",
          paddingBottom: "0.5em",
        }}
      >
        {/* Fixed-height text window: exactly N lines visible, newest at the bottom */}
        <div
          className="flex flex-col justify-end overflow-hidden"
          style={{ height: textAreaHeight }}
        >
          <p className="m-0 break-words">
            {captions.map((c) => (
              <span key={c.id}>{c.text} </span>
            ))}
            {partialText && <span style={{ opacity: 0.65 }}>{partialText}</span>}
          </p>
        </div>

        {settings.status && (
          <span
            className="absolute h-[0.25em] w-[0.25em] rounded-full"
            style={{
              right: "0.4em",
              bottom: settings.pos === "bottom" ? "0.4em" : undefined,
              top: settings.pos === "top" ? "0.4em" : undefined,
              background: connected ? "#22c55e" : "#ef4444",
              opacity: 0.6,
            }}
            title={connected ? "Connected" : "Connecting…"}
          />
        )}
      </div>

      {/* Gear button (appears on mouse move) */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setPanelOpen((o) => !o);
        }}
        className="absolute top-3 left-3 rounded-full bg-black/70 text-white text-sm px-3 py-1.5 transition-opacity"
        style={{ opacity: chromeVisible || panelOpen ? 1 : 0, fontFamily: FONT_STACKS.sans }}
        aria-label="Display settings"
      >
        ⚙ Settings <span className="opacity-60">(S)</span>
      </button>

      {/* Settings panel */}
      {panelOpen && (
        <div
          className="absolute top-14 left-3 w-[340px] max-h-[calc(100vh-5rem)] overflow-y-auto rounded-lg bg-neutral-900/95 text-neutral-100 text-sm shadow-2xl border border-neutral-700"
          style={{ fontFamily: FONT_STACKS.sans, cursor: "default" }}
          onClick={(e) => e.stopPropagation()}
          onMouseMove={(e) => e.stopPropagation()}
        >
          <div className="px-4 py-3 border-b border-neutral-700 flex items-center justify-between">
            <span className="font-semibold">Display settings</span>
            <button
              type="button"
              className="text-neutral-400 hover:text-white"
              onClick={() => setPanelOpen(false)}
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          <div className="p-4 space-y-4">
            <Section title="Text">
              <Row label={`Lines: ${settings.lines}`}>
                <input
                  type="range"
                  min={1}
                  max={8}
                  step={1}
                  value={settings.lines}
                  onChange={(e) => update({ lines: Number(e.target.value) })}
                  className="w-full"
                />
              </Row>
              <Row label={`Size: ${settings.size.toFixed(2)} vw`}>
                <input
                  type="range"
                  min={1.5}
                  max={12}
                  step={0.25}
                  value={settings.size}
                  onChange={(e) => update({ size: Number(e.target.value) })}
                  className="w-full"
                />
              </Row>
              <Row label="Font">
                <select
                  value={settings.font}
                  onChange={(e) => update({ font: e.target.value as Font })}
                  className="w-full bg-neutral-800 rounded px-2 py-1"
                >
                  <option value="sans">Sans</option>
                  <option value="condensed">Condensed</option>
                  <option value="serif">Serif</option>
                  <option value="mono">Mono</option>
                </select>
              </Row>
              <Row label="Text color">
                <ColorInput value={settings.fg} onChange={(v) => update({ fg: v })} />
              </Row>
              <div className="flex gap-4">
                <Toggle
                  label="ALL CAPS"
                  checked={settings.caps}
                  onChange={(v) => update({ caps: v })}
                />
                <Toggle
                  label="Outline"
                  checked={settings.outline}
                  onChange={(v) => update({ outline: v })}
                />
              </div>
              <Row label="Align">
                <Segmented
                  value={settings.align}
                  options={[
                    { value: "left", label: "Left" },
                    { value: "center", label: "Center" },
                  ]}
                  onChange={(v) => update({ align: v as Align })}
                />
              </Row>
              <Row label={`Side margin: ${settings.margin} vw`}>
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={1}
                  value={settings.margin}
                  onChange={(e) => update({ margin: Number(e.target.value) })}
                  className="w-full"
                />
              </Row>
            </Section>

            <Section title="Band">
              <Row label="Position">
                <Segmented
                  value={settings.pos}
                  options={[
                    { value: "bottom", label: "Bottom" },
                    { value: "top", label: "Top" },
                  ]}
                  onChange={(v) => update({ pos: v as Position })}
                />
              </Row>
              <Row label="Band color">
                <ColorInput value={settings.band} onChange={(v) => update({ band: v })} />
              </Row>
              <Row label={`Band opacity: ${Math.round(settings.bandAlpha * 100)}%`}>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={settings.bandAlpha}
                  onChange={(e) => update({ bandAlpha: Number(e.target.value) })}
                  className="w-full"
                />
              </Row>
            </Section>

            <Section title="Screen / key color">
              <div className="flex flex-wrap gap-2">
                {KEY_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => update({ key: p.value })}
                    className="px-2.5 py-1 rounded border text-xs"
                    style={{
                      borderColor:
                        settings.key.toLowerCase() === p.value ? "#fff" : "#525252",
                      background: p.value,
                      color: p.value === "#00ff00" ? "#000" : "#fff",
                    }}
                  >
                    {p.label}
                  </button>
                ))}
                <ColorInput value={settings.key} onChange={(v) => update({ key: v })} />
              </div>
              <p className="text-xs text-neutral-400 mt-1">
                Green/blue lets a switcher key the captions over video. Black is the
                standard look for a plain screen.
              </p>
            </Section>

            <Section title="Other">
              <Toggle
                label="Connection dot"
                checked={settings.status}
                onChange={(v) => update({ status: v })}
              />
            </Section>

            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={toggleFullscreen}
                className="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600"
              >
                Fullscreen (F)
              </button>
              <button
                type="button"
                onClick={copyLink}
                className="px-3 py-1.5 rounded bg-neutral-700 hover:bg-neutral-600"
              >
                {copied ? "Copied!" : "Copy link with these settings"}
              </button>
              <button
                type="button"
                onClick={() => setSettings(DEFAULTS)}
                className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >
                Reset
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              Keys: <kbd>S</kbd> settings · <kbd>F</kbd> fullscreen · <kbd>+</kbd>/<kbd>-</kbd>{" "}
              size · <kbd>[</kbd>/<kbd>]</kbd> lines
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small panel primitives (plain HTML so nothing bleeds onto the key)  */
/* ------------------------------------------------------------------ */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] uppercase tracking-wider text-neutral-400">{title}</div>
      {children}
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-neutral-300">{label}</span>
      {children}
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Segmented({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="inline-flex rounded overflow-hidden border border-neutral-600">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-xs ${
            value === o.value ? "bg-neutral-200 text-black" : "bg-neutral-800 text-neutral-200"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const hex = HEX_COLOR.test(value) ? value : "#000000";
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={hex.length === 4 ? expandHex(hex) : hex.slice(0, 7)}
        onChange={(e) => onChange(e.target.value)}
        className="h-7 w-10 bg-transparent border-0 p-0 cursor-pointer"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => {
          const v = e.target.value.trim();
          if (HEX_COLOR.test(v) || /^[a-zA-Z]{3,20}$/.test(v)) onChange(v);
        }}
        className="w-24 bg-neutral-800 rounded px-2 py-1 text-xs font-mono"
        spellCheck={false}
      />
    </div>
  );
}

function expandHex(h: string) {
  return "#" + h.slice(1).split("").map((c) => c + c).join("");
}
