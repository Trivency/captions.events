/**
 * Per-event branding stored in events.theme (jsonb). Every field is optional;
 * consumers fall back to neutral defaults so an event with no theme still renders.
 */
export interface EventTheme {
  /** Absolute URL to a logo image (PNG/SVG with transparency works best) */
  logo_url?: string
  /** Brand accent color, hex */
  brand_color?: string
  /** Short line shown under the title on the viewer page */
  tagline?: string
  /** Projector display settings (see lib/display-settings.ts); validated there */
  display?: Record<string, unknown>
}

export const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/

export function sanitizeTheme(input: unknown): EventTheme {
  if (!input || typeof input !== "object") return {}
  const t = input as Record<string, unknown>
  const out: EventTheme = {}
  if (typeof t.logo_url === "string" && /^https?:\/\//.test(t.logo_url)) {
    out.logo_url = t.logo_url.slice(0, 2000)
  }
  if (typeof t.brand_color === "string" && HEX_COLOR.test(t.brand_color)) {
    out.brand_color = t.brand_color
  }
  if (typeof t.tagline === "string" && t.tagline.trim()) {
    out.tagline = t.tagline.trim().slice(0, 120)
  }
  if (t.display && typeof t.display === "object") {
    out.display = t.display as Record<string, unknown>
  }
  return out
}
