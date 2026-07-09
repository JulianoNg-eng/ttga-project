// Shared Supabase config + helpers.
// The app talks to Supabase directly over HTTP (edge functions + PostgREST),
// no @supabase/supabase-js client, to match the existing setup.

export const SUPABASE_URL = "https://gpftjspiqmbyotvdayro.supabase.co"
export const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdwZnRqc3BpcW1ieW90dmRheXJvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3ODU4OTQsImV4cCI6MjA3OTM2MTg5NH0.9njRkviMnnfAcj6l8DmXP5fSjuC95aQZWhLDwGO-N0w"

const authHeaders = {
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
}

// Insert a drawing or photo through the insert-drawing edge function.
// Accepts a raw base64 string or a full data URL; the data-URL prefix is stripped.
export async function insertDrawing(base64, type = "drawing") {
  const base64Only = base64.split(",")[1] || base64
  const response = await fetch(`${SUPABASE_URL}/functions/v1/insert-drawing`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ drawingBase64String: base64Only, type }),
  })
  if (!response.ok) throw new Error("Insert failed")
  return response
}

// Fetch rows of a given type from the drawings table (oldest first), via PostgREST.
export async function fetchDrawings(type) {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/drawings?type=eq.${type}&select=id,drawing_data,created_at&order=created_at.asc`,
    { headers: authHeaders }
  )
  if (!response.ok) throw new Error("Fetch failed")
  return response.json()
}

// Delete a single row from the drawings table by id, via PostgREST.
export async function deleteDrawing(id) {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/drawings?id=eq.${id}`, {
    method: "DELETE",
    headers: authHeaders,
  })
  if (!response.ok) throw new Error("Delete failed")
  return response
}
