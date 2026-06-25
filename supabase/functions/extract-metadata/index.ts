import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
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

    // Fetch categories from master table
    const supabase = getServiceClient();
    const { data: categories } = await supabase
      .from("sop_categories")
      .select("id, category_name, keywords");

    const categoryList = (categories || [])
      .map((c: any) => `- ${c.category_name}: keywords=[${(c.keywords || []).join(", ")}]`)
      .join("\n");

    const textSnippet = raw_text.slice(0, 4000);

    const result = await chatCompletionJSON(
      `You are an expert in pharmaceutical GMP SOPs. Extract metadata from the given SOP text.

IMPORTANT: For the "category" field, you MUST pick exactly one from this master list:
${categoryList}

Match the SOP to the most appropriate category based on its content and the keywords provided. If unsure, use "General".

Return JSON with these fields:
- title: the SOP title (clean, no file extensions or codes in it)
- sop_code: the SOP document code/number (e.g., SOP-QA-001, QC/SOP/012) or null if not found
- version: the version number (e.g., "1.0", "3", "Rev 2") or null if not found
- department: one of [Quality Assurance, Quality Control, Manufacturing, Packaging, Warehouse, Engineering, Regulatory Affairs, Human Resources, General]
- category: the SOP area/category from the master list above (use the exact category_name)
- site: the site/location this SOP applies to or "Global" if it applies across all sites
- effective_date: the effective date in YYYY-MM-DD format or null if not found
- summary: one-line summary of what this SOP covers (max 100 chars)`,
      `File name: ${file_name || "unknown"}\n\nSOP Text:\n${textSnippet}`
    );

    // Resolve category_id
    let categoryId = null;
    if (result.category && categories) {
      const match = categories.find(
        (c: any) => c.category_name.toLowerCase() === result.category.toLowerCase()
      );
      if (match) categoryId = match.id;
    }

    return new Response(
      JSON.stringify({
        success: true,
        metadata: { ...result, category_id: categoryId },
      }),
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
