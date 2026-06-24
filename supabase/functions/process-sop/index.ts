import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { generateEmbeddings } from "../_shared/openai.ts";
import { corsHeaders } from "../_shared/cors.ts";

const SECTION_PATTERNS: Record<string, RegExp> = {
  purpose: /^(?:\d+[\.\)]\s*)?(?:purpose|objective|aim)\b/i,
  scope: /^(?:\d+[\.\)]\s*)?scope\b/i,
  responsibilities: /^(?:\d+[\.\)]\s*)?(?:responsibilit|roles?\s+and|accountabilit)/i,
  procedure: /^(?:\d+[\.\)]\s*)?(?:procedure|process|method|steps?|instructions?)\b/i,
  references: /^(?:\d+[\.\)]\s*)?(?:references?|related\s+documents?|applicable\s+documents?)\b/i,
  definitions: /^(?:\d+[\.\)]\s*)?(?:definitions?|glossary|abbreviations?|terms?)\b/i,
};

interface Section {
  section_type: string;
  heading: string;
  content: string;
  order_index: number;
}

function classifyHeading(heading: string): string {
  for (const [type, pattern] of Object.entries(SECTION_PATTERNS)) {
    if (pattern.test(heading.trim())) return type;
  }
  return "other";
}

function splitIntoSections(text: string): Section[] {
  const lines = text.split("\n");
  const sections: Section[] = [];
  let currentHeading = "Document Start";
  let currentType = "other";
  let currentContent: string[] = [];
  let orderIndex = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      currentContent.push("");
      continue;
    }

    const isHeading =
      trimmed.length < 100 &&
      (trimmed === trimmed.toUpperCase() ||
        /^\d+[\.\)]\s+[A-Z]/.test(trimmed) ||
        /^[A-Z][A-Z\s&\/]+$/.test(trimmed));

    if (isHeading && currentContent.length > 0) {
      const content = currentContent.join("\n").trim();
      if (content.length > 10) {
        sections.push({
          section_type: currentType,
          heading: currentHeading,
          content,
          order_index: orderIndex++,
        });
      }
      currentHeading = trimmed;
      currentType = classifyHeading(trimmed);
      currentContent = [];
    } else {
      currentContent.push(trimmed);
    }
  }

  const remaining = currentContent.join("\n").trim();
  if (remaining.length > 10) {
    sections.push({
      section_type: currentType,
      heading: currentHeading,
      content: remaining,
      order_index: orderIndex,
    });
  }

  if (sections.length === 0 && text.trim().length > 10) {
    sections.push({
      section_type: "other",
      heading: "Full Document",
      content: text.trim(),
      order_index: 0,
    });
  }

  return sections;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sop_id } = await req.json();
    if (!sop_id) {
      return new Response(JSON.stringify({ error: "sop_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();

    // Update status to processing
    await supabase
      .from("sop_documents")
      .update({ status: "processing" })
      .eq("id", sop_id);

    // Get the SOP document
    const { data: sop, error: sopError } = await supabase
      .from("sop_documents")
      .select("*")
      .eq("id", sop_id)
      .single();

    if (sopError || !sop) {
      throw new Error(`SOP not found: ${sopError?.message}`);
    }

    let rawText = sop.raw_text;

    // If no raw_text, try to download and extract from file_url
    if (!rawText && sop.file_url) {
      const { data: fileData, error: fileError } = await supabase.storage
        .from("sops")
        .download(sop.file_url);

      if (fileError) throw new Error(`File download error: ${fileError.message}`);

      rawText = await fileData.text();

      await supabase
        .from("sop_documents")
        .update({ raw_text: rawText })
        .eq("id", sop_id);
    }

    if (!rawText || rawText.trim().length === 0) {
      await supabase
        .from("sop_documents")
        .update({ status: "error", error_message: "No text content found" })
        .eq("id", sop_id);

      return new Response(
        JSON.stringify({ error: "No text content found in SOP" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Split into sections
    const sections = splitIntoSections(rawText);

    // Generate embeddings in batch
    const texts = sections.map((s) => `${s.heading}\n${s.content}`);
    const embeddings = await generateEmbeddings(texts);

    // Delete existing sections for this SOP (re-processing)
    await supabase.from("sop_sections").delete().eq("sop_id", sop_id);

    // Insert sections with embeddings
    const sectionRows = sections.map((s, i) => ({
      sop_id,
      section_type: s.section_type,
      heading: s.heading,
      content: s.content,
      embedding: JSON.stringify(embeddings[i]),
      order_index: s.order_index,
    }));

    const { error: insertError } = await supabase
      .from("sop_sections")
      .insert(sectionRows);

    if (insertError) throw new Error(`Section insert error: ${insertError.message}`);

    // Update SOP status to ready
    await supabase
      .from("sop_documents")
      .update({ status: "ready", updated_at: new Date().toISOString() })
      .eq("id", sop_id);

    return new Response(
      JSON.stringify({
        success: true,
        sop_id,
        sections_count: sections.length,
        sections: sections.map((s) => ({
          type: s.section_type,
          heading: s.heading,
        })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-sop error:", error);

    try {
      const supabase = getServiceClient();
      const body = await req.clone().json().catch(() => ({}));
      if (body.sop_id) {
        await supabase
          .from("sop_documents")
          .update({ status: "error", error_message: error.message })
          .eq("id", body.sop_id);
      }
    } catch (_) {}

    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
