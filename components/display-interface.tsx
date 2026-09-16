"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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
  /** Number of finished lines to keep on screen */
  lines: number;
  /** Font size in viewport-width units */
  size: number;
  /** CSS colors */
  bg: string;
  fg: string;
}

/**
 * Full-screen caption output intended for a projector / secondary display.
 * Same data path as ViewerInterface (postgres_changes for finals, Realtime
 * Broadcast for partials), no chrome, no translation UI.
 */
export function DisplayInterface({
  event,
  lines,
  size,
  bg,
  fg,
}: DisplayInterfaceProps) {
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [partialText, setPartialText] = useState("");
  const [connected, setConnected] = useState(false);
  const supabase = getSupabaseBrowserClient();

  // Load the most recent finals on mount so the screen isn't blank on refresh
  useEffect(() => {
    const loadCaptions = async () => {
      const { data, error } = await supabase
        .from("captions")
        .select("*")
        .eq("event_id", event.id)
        .eq("is_final", true)
        .order("sequence_number", { ascending: false })
        .limit(lines);

      if (error) {
        console.error("Error loading captions:", error);
      } else if (data) {
        setCaptions([...data].reverse());
      }
    };

    loadCaptions();
  }, [event.id, lines, supabase]);

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
            return [...prev, payload.new].slice(-lines);
          });
        }
      )
      .subscribe((status: string) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [event.id, lines, supabase]);

  // Partial (in-progress) transcript
  useEffect(() => {
    const broadcastChannel = supabase
      .channel(`broadcast:${event.uid}`)
      .on(
        "broadcast",
        { event: "partial_transcript" },
        (payload: { payload: { text: string } }) => {
          setPartialText(payload.payload.text);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(broadcastChannel);
    };
  }, [event.uid, supabase]);

  return (
    <div
      className="fixed inset-0 flex flex-col justify-end overflow-hidden cursor-none select-none"
      style={{ background: bg, color: fg }}
    >
      <div
        className="px-[4vw] pb-[4vh] pt-[2vh] font-semibold leading-tight"
        style={{ fontSize: `${size}vw`, textShadow: "0 0.06em 0.2em rgba(0,0,0,0.6)" }}
      >
        {captions.map((caption) => (
          <p key={caption.id} className="mb-[0.35em]">
            {caption.text}
          </p>
        ))}
        {partialText && (
          <p className="mb-[0.35em]" style={{ opacity: 0.7 }}>
            {partialText}
          </p>
        )}
      </div>
      {/* Tiny connection dot, bottom-right; green = live */}
      <div
        className="absolute bottom-2 right-2 h-2 w-2 rounded-full"
        style={{ background: connected ? "#22c55e" : "#ef4444", opacity: 0.6 }}
        title={connected ? "Connected" : "Connecting…"}
      />
    </div>
  );
}
