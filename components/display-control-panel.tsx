"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Check, Copy, ExternalLink, MonitorPlay } from "lucide-react"
import { getSupabaseBrowserClient } from "@/lib/supabase/client"
import {
  DISPLAY_DEFAULTS,
  DISPLAY_SETTINGS_EVENT,
  displayChannelName,
  displaySettingsToQuery,
  type DisplaySettings,
} from "@/lib/display-settings"
import { DisplaySettingsControls } from "@/components/display-settings-controls"

interface DisplayControlPanelProps {
  eventId: string
  eventUid: string
  displayUrl: string
  initialSettings: DisplaySettings
}

type SaveState = "idle" | "saving" | "saved" | "error"

/**
 * Broadcast-page controls for the projector display. Every change is pushed
 * live to open display windows over Realtime and saved on the event
 * (theme.display) so a display reload comes back with the same look.
 */
export function DisplayControlPanel({
  eventId,
  eventUid,
  displayUrl,
  initialSettings,
}: DisplayControlPanelProps) {
  const [settings, setSettings] = useState<DisplaySettings>(initialSettings)
  const [saveState, setSaveState] = useState<SaveState>("idle")
  const [saveError, setSaveError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const supabase = getSupabaseBrowserClient()

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latest = useRef(settings)
  latest.current = settings

  // Keep a broadcast channel open so pushes are instant
  useEffect(() => {
    const channel = supabase.channel(displayChannelName(eventUid))
    channel.subscribe()
    channelRef.current = channel
    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [eventUid, supabase])

  const push = (next: DisplaySettings) => {
    channelRef.current?.send({
      type: "broadcast",
      event: DISPLAY_SETTINGS_EVENT,
      payload: next,
    })
  }

  // Debounced save: merge into theme so branding fields are preserved
  const scheduleSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    setSaveState("saving")
    saveTimer.current = setTimeout(async () => {
      const { data: row, error: readError } = await supabase
        .from("events")
        .select("theme")
        .eq("id", eventId)
        .single()
      if (readError) {
        setSaveState("error")
        setSaveError(friendlyError(readError.message))
        return
      }
      const theme = { ...((row?.theme as Record<string, unknown>) ?? {}), display: latest.current }
      const { error } = await supabase.from("events").update({ theme }).eq("id", eventId)
      if (error) {
        setSaveState("error")
        setSaveError(friendlyError(error.message))
      } else {
        setSaveState("saved")
        setSaveError(null)
      }
    }, 700)
  }

  const apply = (next: DisplaySettings) => {
    setSettings(next)
    push(next)
    scheduleSave()
  }

  const onChange = (patch: Partial<DisplaySettings>) => apply({ ...settings, ...patch })

  const copyLink = async () => {
    const qs = displaySettingsToQuery(settings)
    try {
      await navigator.clipboard.writeText(`${displayUrl}${qs ? `?${qs}` : ""}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <MonitorPlay className="h-5 w-5 text-primary" />
            <CardTitle>Projector Display</CardTitle>
          </div>
          <span className="text-xs text-muted-foreground">
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Saved"}
            {saveState === "error" && <span className="text-destructive">Not saved</span>}
          </span>
        </div>
        <CardDescription>
          Controls the full-screen caption output. Changes apply live to any open display window
          and are remembered for this event.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <p className="text-sm font-medium mb-2">Display link</p>
          <div className="flex gap-2">
            <div className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono truncate">
              {displayUrl}
            </div>
            <Button variant="outline" size="sm" onClick={copyLink} title="Copy link with current settings">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href={`/display/${eventUid}`} target="_blank">
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Open it, drag the window to the external display, press F for full screen.
          </p>
        </div>

        <DisplaySettingsControls settings={settings} onChange={onChange} />

        {saveError && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">{saveError}</div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => apply(DISPLAY_DEFAULTS)}>
            Reset to defaults
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function friendlyError(message: string) {
  return message.includes("theme")
    ? "Your database is missing the `theme` column, so settings still push live but won't survive a display reload. Run supabase/migrations/20260916000000_event_theme.sql in the Supabase SQL Editor."
    : message
}
