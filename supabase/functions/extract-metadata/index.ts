import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { chatCompletionJSON } from "../_shared/openai.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { raw_text, file_name } = await req.json();
    if (!raw_text) {
      return new Response(
        JSON.stringify({ error: "raw_text required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const textSnippet = raw_text.slice(0, 4000);

    const result = await chatCompletionJSON(
      `You are an expert in pharmaceutical GMP SOPs. Extract metadata from the given SOP text. Return JSON with these fields:
- title: the SOP title (clean, no file extensions or codes in it)
- sop_code: the SOP document code/number (e.g., SOP-QA-001, QC/SOP/012) or null if not found
- version: the version number (e.g., "1.0", "3", "Rev 2") or null if not found
- department: one of [Quality Assurance, Quality Control, Manufacturing, Packaging, Warehouse, Engineering, Regulatory Affairs, Human Resources, General] - infer from content if not explicitly stated
- effective_date: the effective date in YYYY-MM-DD format or null if not found
- site: the site/location this SOP applies to (e.g., "Plant 1", "Unit 2", "Hyderabad", "Mumbai") or "Global" if it applies across all sites
- summary: one-line summary of what this SOP covers (max 100 chars)`,
      `File name: ${file_name || "unknown"}\n\nSOP Text:\n${textSnippet}`
    );

    return new Response(
      JSON.stringify({ success: true, metadata: result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("extract-metadata error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
