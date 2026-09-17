"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  DISPLAY_DEFAULTS,
  DISPLAY_SETTINGS_EVENT,
  FONT_STACKS,
  LIMITS,
  displayChannelName,
  displaySettingsToQuery,
  hexToRgba,
  parseDisplaySettings,
  type DisplaySettings,
} from "@/lib/display-settings";
import { DisplaySettingsControls } from "@/components/display-settings-controls";

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
  /** Settings saved on the event (theme.display); the broadcast page edits these */
  serverSettings: DisplaySettings;
  /** Raw query params; a one-off override for this window only */
  initialQuery: Record<string, string | undefined>;
  /** Seed captions (used by previews/tests); live captions are appended after these */
  initialCaptions?: Caption[];
}

const LINE_HEIGHT = 1.25;
const MAX_SEGMENTS = 60;

/**
 * Full-screen caption output for a projector / second display / switcher.
 * Settings come from the broadcast page (saved on the event and pushed live
 * over Realtime). The local overlay (press S) can still tweak this window.
 */
export function DisplayInterface({
  event,
  serverSettings,
  initialQuery,
  initialCaptions = [],
}: DisplayInterfaceProps) {
  // Query params (if any) override the saved settings for this window
  const [settings, setSettings] = useState<DisplaySettings>(() =>
    parseDisplaySettings(initialQuery, serverSettings)
  );

  // Mirror into the URL so the current look can be copied with the link
  useEffect(() => {
    const qs = displaySettingsToQuery(settings);
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}`);
  }, [settings]);

  const update = useCallback(
    (patch: Partial<DisplaySettings>) => setSettings((s) => ({ ...s, ...patch })),
    []
  );

  /* ---------------- data ---------------- */
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

  // Final captions
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

  // Partial transcript
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

  // Live settings pushed from the broadcast page
  useEffect(() => {
    const channel = supabase
      .channel(displayChannelName(event.uid))
      .on(
        "broadcast",
        { event: DISPLAY_SETTINGS_EVENT },
        (payload: { payload: Record<string, unknown> }) =>
          setSettings((current) => parseDisplaySettings(payload.payload, current))
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.uid, supabase]);

  /* ---------------- UI chrome (overlay, cursor, hotkeys) ---------------- */
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
          setSettings((s) => ({
            ...s,
            size: Math.min(LIMITS.size.max, +(s.size + 0.25).toFixed(2)),
          }));
          break;
        case "-":
        case "_":
          setSettings((s) => ({
            ...s,
            size: Math.max(LIMITS.size.min, +(s.size - 0.25).toFixed(2)),
          }));
          break;
        case "]":
          setSettings((s) => ({ ...s, lines: Math.min(LIMITS.lines.max, s.lines + 1) }));
          break;
        case "[":
          setSettings((s) => ({ ...s, lines: Math.max(LIMITS.lines.min, s.lines - 1) }));
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

  /* ---------------- derived styles ---------------- */
  const bandStyle = useMemo(
    () => ({
      background: hexToRgba(settings.band, settings.bandAlpha),
      color: settings.fg,
      fontFamily: FONT_STACKS[settings.font],
      fontSize: `${settings.size}vw`,
      lineHeight: LINE_HEIGHT,
      paddingLeft: `${settings.margin}vw`,
      paddingRight: `${settings.margin}vw`,
      textAlign: settings.align,
      textTransform: settings.caps ? ("uppercase" as const) : ("none" as const),
      textShadow: settings.outline
        ? "0 0 0.06em #000, 0 0 0.06em #000, 0.04em 0.04em 0 #000, -0.04em -0.04em 0 #000, 0.04em -0.04em 0 #000, -0.04em 0.04em 0 #000"
        : "none",
    }),
    [settings]
  );

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
        style={{ ...bandStyle, [settings.pos]: 0, paddingTop: "0.5em", paddingBottom: "0.5em" }}
      >
        {/* Fixed-height text window: exactly N lines visible, newest at the bottom */}
        <div className="flex flex-col justify-end overflow-hidden" style={{ height: textAreaHeight }}>
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

      {/* Toolbar (appears on mouse move) */}
      <div
        className="absolute top-3 left-3 flex gap-2 transition-opacity"
        style={{ opacity: chromeVisible || panelOpen ? 1 : 0, fontFamily: FONT_STACKS.sans }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFullscreen();
          }}
          className="rounded-full bg-black/70 text-white text-sm px-3 py-1.5 hover:bg-black/90"
          aria-label="Toggle full screen"
        >
          ⛶ Fullscreen <span className="opacity-60">(F)</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPanelOpen((o) => !o);
          }}
          className="rounded-full bg-black/70 text-white text-sm px-3 py-1.5 hover:bg-black/90"
          aria-label="Display settings"
        >
          ⚙ Settings <span className="opacity-60">(S)</span>
        </button>
      </div>

      {/* Local overlay — tweaks this window only; the broadcast page is the main control */}
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
            <p className="text-xs text-neutral-400">
              Local tweaks for this window. To change the look for good, use the Projector Display
              card on the broadcast page.
            </p>
            <DisplaySettingsControls settings={settings} onChange={update} dark />
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
                onClick={() => setSettings(serverSettings)}
                className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >
                Back to saved
              </button>
              <button
                type="button"
                onClick={() => setSettings(DISPLAY_DEFAULTS)}
                className="px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300"
              >
                Reset
              </button>
            </div>
            <p className="text-xs text-neutral-500">
              Keys: <kbd>S</kbd> settings · <kbd>F</kbd> fullscreen · <kbd>+</kbd>/<kbd>-</kbd> size ·{" "}
              <kbd>[</kbd>/<kbd>]</kbd> lines
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
