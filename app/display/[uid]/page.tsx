import { notFound } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { DisplayInterface } from "@/components/display-interface"

interface DisplayPageProps {
  params: Promise<{
    uid: string
  }>
  searchParams: Promise<{
    lines?: string
    size?: string
    bg?: string
    fg?: string
  }>
}

function clampInt(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number.parseInt(value ?? "", 10)
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function clampFloat(value: string | undefined, fallback: number, min: number, max: number) {
  const n = Number.parseFloat(value ?? "")
  if (Number.isNaN(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

// Only allow simple color tokens so a query param can't inject CSS
function safeColor(value: string | undefined, fallback: string) {
  if (!value) return fallback
  return /^(#[0-9a-fA-F]{3,8}|[a-zA-Z]{3,20})$/.test(value) ? value : fallback
}

/**
 * Full-screen caption display for a projector or secondary monitor.
 *
 * /display/<uid>?lines=3&size=5&bg=black&fg=white
 *   lines  finished lines kept on screen (1–10, default 3)
 *   size   font size in vw (1–15, default 5)
 *   bg/fg  background / text color (hex or CSS color name)
 */
export default async function DisplayPage({ params, searchParams }: DisplayPageProps) {
  const { uid } = await params
  const query = await searchParams
  const supabase = await getSupabaseServerClient()

  const { data: event, error } = await supabase
    .from("events")
    .select("id, uid, title")
    .eq("uid", uid)
    .single()

  if (error || !event) {
    notFound()
  }

  return (
    <DisplayInterface
      event={event}
      lines={clampInt(query.lines, 3, 1, 10)}
      size={clampFloat(query.size, 5, 1, 15)}
      bg={safeColor(query.bg, "black")}
      fg={safeColor(query.fg, "white")}
    />
  )
}
