/**
 * Settings for the projector display page. Shared between the display page
 * (which renders them) and the broadcast page (which edits them and pushes
 * changes live). Persisted on the event as theme.display.
 */
import { HEX_COLOR } from "@/lib/event-theme"

export type Position = "bottom" | "top"
export type Align = "left" | "center"
export type Font = "sans" | "serif" | "mono" | "condensed"

export interface DisplaySettings {
  /** visible text lines inside the band */
  lines: number
  /** font size in vw */
  size: number
  font: Font
  /** screen (key) color behind the band */
  key: string
  /** band color */
  band: string
  /** band opacity 0–1 */
  bandAlpha: number
  /** text color */
  fg: string
  pos: Position
  align: Align
  caps: boolean
  /** horizontal safe margin, vw */
  margin: number
  outline: boolean
  /** show the tiny connection dot */
  status: boolean
}

export const DISPLAY_DEFAULTS: DisplaySettings = {
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
}

export const LIMITS = {
  lines: { min: 1, max: 8 },
  size: { min: 1.5, max: 12 },
  margin: { min: 0, max: 20 },
}

export const KEY_PRESETS: { label: string; value: string }[] = [
  { label: "Black", value: "#000000" },
  { label: "Green", value: "#00ff00" },
  { label: "Blue", value: "#0000ff" },
  { label: "Magenta", value: "#ff00ff" },
]

export const FONT_STACKS: Record<Font, string> = {
  sans: "ui-sans-serif, system-ui, -apple-system, 'Helvetica Neue', Arial, sans-serif",
  serif: "ui-serif, Georgia, 'Times New Roman', serif",
  mono: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
  condensed: "'Arial Narrow', 'Helvetica Neue Condensed', 'Roboto Condensed', Impact, sans-serif",
}

/** Realtime channel + event used to push settings from the broadcast page to displays */
export const displayChannelName = (uid: string) => `display:${uid}`
export const DISPLAY_SETTINGS_EVENT = "settings"

/* ---------- parsing / validation ---------- */

// Accept hex or a short CSS color name; anything else is ignored
export function safeColor(v: unknown, fallback: string) {
  if (typeof v !== "string" || !v) return fallback
  if (HEX_COLOR.test(v)) return v
  if (/^[a-zA-Z]{3,20}$/.test(v)) return v
  return fallback
}
function num(v: unknown, fallback: number, min: number, max: number) {
  const n = typeof v === "number" ? v : Number.parseFloat(String(v ?? ""))
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}
function bool(v: unknown, fallback: boolean) {
  if (v === undefined || v === null) return fallback
  if (typeof v === "boolean") return v
  return v === "1" || v === "true"
}
function oneOf<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
  return (allowed as readonly string[]).includes(String(v)) ? (v as T) : fallback
}

/**
 * Build settings from any loosely-typed source (query string, JSON from the
 * database, a Realtime payload) on top of `base`. Unknown/invalid values keep
 * the base value.
 */
export function parseDisplaySettings(
  q: Record<string, unknown> | null | undefined,
  base: DisplaySettings = DISPLAY_DEFAULTS
): DisplaySettings {
  const s = q ?? {}
  return {
    lines: Math.round(num(s.lines, base.lines, LIMITS.lines.min, LIMITS.lines.max)),
    size: num(s.size, base.size, LIMITS.size.min, LIMITS.size.max),
    font: oneOf(s.font, ["sans", "serif", "mono", "condensed"] as const, base.font),
    key: safeColor(s.key ?? s.bg, base.key),
    band: safeColor(s.band, base.band),
    bandAlpha: num(s.bandAlpha ?? s.alpha, base.bandAlpha, 0, 1),
    fg: safeColor(s.fg, base.fg),
    pos: oneOf(s.pos, ["bottom", "top"] as const, base.pos),
    align: oneOf(s.align, ["left", "center"] as const, base.align),
    caps: bool(s.caps, base.caps),
    margin: num(s.margin, base.margin, LIMITS.margin.min, LIMITS.margin.max),
    outline: bool(s.outline, base.outline),
    status: bool(s.status, base.status),
  }
}

/** Query string with only the non-default values */
export function displaySettingsToQuery(s: DisplaySettings): string {
  const p = new URLSearchParams()
  ;(Object.keys(DISPLAY_DEFAULTS) as (keyof DisplaySettings)[]).forEach((k) => {
    if (s[k] === DISPLAY_DEFAULTS[k]) return
    const key = k === "bandAlpha" ? "alpha" : k
    const v = s[k]
    p.set(key, typeof v === "boolean" ? (v ? "1" : "0") : String(v))
  })
  return p.toString()
}

export function hexToRgba(hex: string, alpha: number) {
  if (!HEX_COLOR.test(hex)) return hex // named color: alpha ignored
  let h = hex.slice(1)
  if (h.length === 3) h = h.split("").map((c) => c + c).join("")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
