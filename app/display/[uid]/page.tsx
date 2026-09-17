import { notFound } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { DisplayInterface } from "@/components/display-interface"
import { sanitizeTheme } from "@/lib/event-theme"
import { parseDisplaySettings } from "@/lib/display-settings"

interface DisplayPageProps {
  params: Promise<{
    uid: string
  }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Full-screen caption display for a projector, second monitor, or a video
 * switcher (chroma key). Its look is controlled from the broadcast page
 * ("Projector Display" card): saved on the event and pushed live. Query params
 * act as a one-off override for this window, e.g. ?lines=3&key=%2300ff00.
 */
export default async function DisplayPage({ params, searchParams }: DisplayPageProps) {
  const { uid } = await params
  const rawQuery = await searchParams
  const supabase = await getSupabaseServerClient()

  const { data: event, error } = await supabase
    .from("events")
    .select("*")
    .eq("uid", uid)
    .single()

  if (error || !event) {
    notFound()
  }

  // Only the first value of any repeated param matters
  const initialQuery: Record<string, string | undefined> = {}
  for (const [k, v] of Object.entries(rawQuery)) {
    initialQuery[k] = Array.isArray(v) ? v[0] : v
  }

  const theme = sanitizeTheme(event.theme)

  return (
    <DisplayInterface
      event={{ id: event.id, uid: event.uid, title: event.title }}
      serverSettings={parseDisplaySettings(theme.display)}
      initialQuery={initialQuery}
    />
  )
}
