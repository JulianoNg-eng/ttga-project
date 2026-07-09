import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const index = parseInt(url.searchParams.get("index") ?? "0", 10)

    if (Number.isNaN(index) || index < 0) {
      return new Response(
        JSON.stringify({ error: "index must be a non-negative integer" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    )

    // Nth photo (0-based) ordered oldest first, plus the total photo count.
    const { data, count, error } = await supabase
      .from("drawings")
      .select("drawing_data", { count: "exact" })
      .eq("type", "photo")
      .order("created_at", { ascending: true })
      .range(index, index)

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      })
    }

    return new Response(
      JSON.stringify({
        drawing_data: data?.[0]?.drawing_data ?? null,
        total_count: count ?? 0,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    })
  }
})
