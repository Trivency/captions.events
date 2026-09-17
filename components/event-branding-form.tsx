"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Palette } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import { sanitizeTheme, type EventTheme } from "@/lib/event-theme"

interface EventBrandingFormProps {
  eventId: string
  initialTheme: EventTheme
}

/**
 * Lets the event creator set a logo, brand color and tagline. Saved to
 * events.theme and picked up by the viewer page.
 */
export function EventBrandingForm({ eventId, initialTheme }: EventBrandingFormProps) {
  const [logoUrl, setLogoUrl] = useState(initialTheme.logo_url ?? "")
  const [brandColor, setBrandColor] = useState(initialTheme.brand_color ?? "#7c3aed")
  const [tagline, setTagline] = useState(initialTheme.tagline ?? "")
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = getSupabaseBrowserClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSaved(false)

    const branding = sanitizeTheme({ logo_url: logoUrl, brand_color: brandColor, tagline })

    // Merge so the projector display settings stored alongside are kept
    const { data: row } = await supabase.from("events").select("theme").eq("id", eventId).single()
    const existing = (row?.theme as Record<string, unknown> | null) ?? {}
    const theme = { ...existing, logo_url: undefined, brand_color: undefined, tagline: undefined, ...branding }

    const { error: updateError } = await supabase
      .from("events")
      .update({ theme })
      .eq("id", eventId)

    if (updateError) {
      // Most likely cause on an older database: the theme column doesn't exist yet
      setError(
        updateError.message.includes("theme")
          ? "Your database is missing the `theme` column. Run supabase/migrations/20260916000000_event_theme.sql in the Supabase SQL Editor, then try again."
          : updateError.message
      )
    } else {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          <CardTitle>Branding</CardTitle>
        </div>
        <CardDescription>
          Shown to remote viewers on the web viewer page. The projector display stays captions-only.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="logo-url">Logo URL</Label>
            <Input
              id="logo-url"
              type="url"
              placeholder="https://example.com/logo.png"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              disabled={saving}
            />
            <p className="text-xs text-muted-foreground">
              A PNG or SVG with a transparent background works best. Must be a public https link.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="brand-color">Brand color</Label>
              <div className="flex items-center gap-2">
                <input
                  id="brand-color"
                  type="color"
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  disabled={saving}
                  className="h-9 w-12 cursor-pointer rounded border bg-transparent p-1"
                />
                <Input
                  value={brandColor}
                  onChange={(e) => setBrandColor(e.target.value)}
                  disabled={saving}
                  className="font-mono"
                  maxLength={9}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="tagline">Tagline</Label>
              <Input
                id="tagline"
                placeholder="Live captions by RYTE Productions"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                disabled={saving}
                maxLength={120}
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{error}</div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save branding"}
            </Button>
            {saved && <span className="text-sm text-muted-foreground">Saved</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
