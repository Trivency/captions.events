"use client"

import type React from "react"
import {
  DISPLAY_DEFAULTS,
  KEY_PRESETS,
  LIMITS,
  type Align,
  type DisplaySettings,
  type Font,
  type Position,
} from "@/lib/display-settings"
import { HEX_COLOR } from "@/lib/event-theme"

interface DisplaySettingsControlsProps {
  settings: DisplaySettings
  onChange: (patch: Partial<DisplaySettings>) => void
  /** dark = for the overlay on the display page; light = for the app UI */
  dark?: boolean
}

/**
 * The full set of projector display controls. Used on the broadcast page
 * (pushes changes to the display) and inside the display page's own overlay.
 */
export function DisplaySettingsControls({ settings, onChange, dark = false }: DisplaySettingsControlsProps) {
  const t = dark ? DARK : LIGHT

  return (
    <div className="space-y-5">
      <Section title="Text" t={t}>
        <Row label={`Lines: ${settings.lines}`} t={t}>
          <input
            type="range"
            min={LIMITS.lines.min}
            max={LIMITS.lines.max}
            step={1}
            value={settings.lines}
            onChange={(e) => onChange({ lines: Number(e.target.value) })}
            className="w-full"
          />
        </Row>
        <Row label={`Size: ${settings.size.toFixed(2)} vw`} t={t}>
          <input
            type="range"
            min={LIMITS.size.min}
            max={LIMITS.size.max}
            step={0.25}
            value={settings.size}
            onChange={(e) => onChange({ size: Number(e.target.value) })}
            className="w-full"
          />
        </Row>
        <Row label="Font" t={t}>
          <select
            value={settings.font}
            onChange={(e) => onChange({ font: e.target.value as Font })}
            className={`w-full rounded px-2 py-1 ${t.input}`}
          >
            <option value="sans">Sans</option>
            <option value="condensed">Condensed</option>
            <option value="serif">Serif</option>
            <option value="mono">Mono</option>
          </select>
        </Row>
        <Row label="Text color" t={t}>
          <ColorInput value={settings.fg} onChange={(v) => onChange({ fg: v })} t={t} />
        </Row>
        <div className="flex gap-4">
          <Toggle label="ALL CAPS" checked={settings.caps} onChange={(v) => onChange({ caps: v })} />
          <Toggle label="Outline" checked={settings.outline} onChange={(v) => onChange({ outline: v })} />
        </div>
        <Row label="Align" t={t}>
          <Segmented
            value={settings.align}
            options={[
              { value: "left", label: "Left" },
              { value: "center", label: "Center" },
            ]}
            onChange={(v) => onChange({ align: v as Align })}
            t={t}
          />
        </Row>
        <Row label={`Side margin: ${settings.margin} vw`} t={t}>
          <input
            type="range"
            min={LIMITS.margin.min}
            max={LIMITS.margin.max}
            step={1}
            value={settings.margin}
            onChange={(e) => onChange({ margin: Number(e.target.value) })}
            className="w-full"
          />
        </Row>
      </Section>

      <Section title="Band" t={t}>
        <Row label="Position" t={t}>
          <Segmented
            value={settings.pos}
            options={[
              { value: "bottom", label: "Bottom" },
              { value: "top", label: "Top" },
            ]}
            onChange={(v) => onChange({ pos: v as Position })}
            t={t}
          />
        </Row>
        <Row label="Band color" t={t}>
          <ColorInput value={settings.band} onChange={(v) => onChange({ band: v })} t={t} />
        </Row>
        <Row label={`Band opacity: ${Math.round(settings.bandAlpha * 100)}%`} t={t}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={settings.bandAlpha}
            onChange={(e) => onChange({ bandAlpha: Number(e.target.value) })}
            className="w-full"
          />
        </Row>
      </Section>

      <Section title="Screen / key color" t={t}>
        <div className="flex flex-wrap items-center gap-2">
          {KEY_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => onChange({ key: p.value })}
              className="px-2.5 py-1 rounded border text-xs"
              style={{
                borderColor: settings.key.toLowerCase() === p.value ? t.selectedBorder : t.border,
                borderWidth: settings.key.toLowerCase() === p.value ? 2 : 1,
                background: p.value,
                color: p.value === "#00ff00" ? "#000" : "#fff",
              }}
            >
              {p.label}
            </button>
          ))}
          <ColorInput value={settings.key} onChange={(v) => onChange({ key: v })} t={t} />
        </div>
        <p className={`text-xs ${t.muted}`}>
          Green/blue lets a switcher key the captions over video. Black is the standard look for a
          plain screen.
        </p>
      </Section>

      <Section title="Other" t={t}>
        <Toggle
          label="Connection dot"
          checked={settings.status}
          onChange={(v) => onChange({ status: v })}
        />
      </Section>
    </div>
  )
}

export function isDefaultSettings(s: DisplaySettings) {
  return (Object.keys(DISPLAY_DEFAULTS) as (keyof DisplaySettings)[]).every(
    (k) => s[k] === DISPLAY_DEFAULTS[k]
  )
}

/* ---------- theme tokens ---------- */

interface Tokens {
  heading: string
  label: string
  muted: string
  input: string
  border: string
  selectedBorder: string
  segOn: string
  segOff: string
}

const DARK: Tokens = {
  heading: "text-neutral-400",
  label: "text-neutral-300",
  muted: "text-neutral-400",
  input: "bg-neutral-800 text-neutral-100",
  border: "#525252",
  selectedBorder: "#ffffff",
  segOn: "bg-neutral-200 text-black",
  segOff: "bg-neutral-800 text-neutral-200",
}

const LIGHT: Tokens = {
  heading: "text-muted-foreground",
  label: "text-foreground",
  muted: "text-muted-foreground",
  input: "bg-muted text-foreground border",
  border: "#d4d4d4",
  selectedBorder: "#111111",
  segOn: "bg-primary text-primary-foreground",
  segOff: "bg-muted text-foreground",
}

/* ---------- primitives ---------- */

function Section({ title, t, children }: { title: string; t: Tokens; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className={`text-[11px] uppercase tracking-wider ${t.heading}`}>{title}</div>
      {children}
    </div>
  )
}

function Row({ label, t, children }: { label: string; t: Tokens; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className={`text-xs ${t.label}`}>{label}</span>
      {children}
    </label>
  )
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-xs cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}

function Segmented({
  value,
  options,
  onChange,
  t,
}: {
  value: string
  options: { value: string; label: string }[]
  onChange: (v: string) => void
  t: Tokens
}) {
  return (
    <div className="inline-flex rounded overflow-hidden border" style={{ borderColor: t.border }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={`px-3 py-1 text-xs ${value === o.value ? t.segOn : t.segOff}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

function ColorInput({
  value,
  onChange,
  t,
}: {
  value: string
  onChange: (v: string) => void
  t: Tokens
}) {
  const hex = HEX_COLOR.test(value) ? value : "#000000"
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
          const v = e.target.value.trim()
          if (HEX_COLOR.test(v) || /^[a-zA-Z]{3,20}$/.test(v)) onChange(v)
        }}
        className={`w-24 rounded px-2 py-1 text-xs font-mono ${t.input}`}
        spellCheck={false}
      />
    </div>
  )
}

function expandHex(h: string) {
  return "#" + h.slice(1).split("").map((c) => c + c).join("")
}
