// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS"
};

Deno.serve(async (req) => {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only allow GET
  if (req.method !== 'GET') {
    return new Response(JSON.stringify({ message: 'Method not allowed. Use GET.' }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      status: 405
    });
  }

  try {
    // Get ?index=N from URL (defaults to 0)
    const url = new URL(req.url);
    const index = parseInt(url.searchParams.get('index') ?? '0', 10);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: {
            Authorization: req.headers.get('Authorization')!
          }
        }
      }
    );

    // Get total count of photos first
    const { count, error: countError } = await supabase
      .from('drawings')
      .select('*', { count: 'exact', head: true })
      .eq('type', 'photo');

    if (countError) throw countError;

    const totalCount = count ?? 0;

    // If no photos exist, return early
    if (totalCount === 0) {
      return new Response(JSON.stringify({
        drawing_data: null,
        total_count: 0
      }), {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
        status: 200
      });
    }

    // Clamp index to valid range (wraps around)
    const safeIndex = index % totalCount;

    // Fetch the Nth photo ordered by created_at
    const { data, error } = await supabase
      .from('drawings')
      .select('drawing_data')
      .eq('type', 'photo')
      .order('created_at', { ascending: true })
      .range(safeIndex, safeIndex)
      .single();

    if (error) throw error;

    return new Response(JSON.stringify({
      drawing_data: data.drawing_data,
      total_count: totalCount
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      status: 200
    });

  } catch (err) {
    return new Response(JSON.stringify({
      message: err?.message ?? err
    }), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      status: 500
    });
  }
});
