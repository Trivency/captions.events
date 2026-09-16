import { notFound } from "next/navigation"
import { getSupabaseServerClient } from "@/lib/supabase/server"
import { ViewerInterface } from "@/components/viewer-interface"
import { Captions } from "lucide-react"
import { sanitizeTheme } from "@/lib/event-theme"

interface ViewPageProps {
  params: Promise<{
    uid: string
  }>
}

export default async function ViewPage({ params }: ViewPageProps) {
  const { uid } = await params
  const supabase = await getSupabaseServerClient()

  // Fetch the event (no auth required for viewing)
  const { data: event, error } = await supabase.from("events").select("*").eq("uid", uid).single()

  if (error || !event) {
    notFound()
  }

  const theme = sanitizeTheme(event.theme)
  const accent = theme.brand_color

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      {/* Header — branded per event when a theme is set */}
      <header
        className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-50"
        style={accent ? { borderBottomColor: accent, borderBottomWidth: 3 } : undefined}
      >
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {theme.logo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logo_url} alt="" className="h-8 w-auto" />
            ) : (
              <Captions className="h-6 w-6" style={accent ? { color: accent } : undefined} />
            )}
            <div className="leading-tight">
              <div className="font-bold text-xl">{event.title}</div>
              {theme.tagline && (
                <div className="text-xs text-muted-foreground">{theme.tagline}</div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <ViewerInterface event={event} />
      </main>
    </div>
  )
}
