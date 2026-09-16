import { notFound } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { DisplayInterface } from "@/components/display-interface"
import { sanitizeTheme } from "@/lib/event-theme"

interface DisplayPageProps {
  params: Promise<{
    uid: string
  }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

/**
 * Full-screen caption output for a projector, second monitor, or a video
 * switcher (chroma key). Settings live in the on-screen panel (press S) and
 * are mirrored into the query string so a look can be bookmarked or shared:
 *
 *   /display/<uid>?lines=2&size=4&key=%2300ff00&band=%23000000&pos=bottom
 *
 * See DisplaySettings in components/display-interface.tsx for every param.
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

  return (
    <DisplayInterface
      event={{
        id: event.id,
        uid: event.uid,
        title: event.title,
        theme: sanitizeTheme(event.theme),
      }}
      initialQuery={initialQuery}
    />
  )
}
