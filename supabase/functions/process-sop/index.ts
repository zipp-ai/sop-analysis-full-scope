import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { generateEmbeddings, chatCompletionJSON } from "../_shared/openai.ts";
import { corsHeaders } from "../_shared/cors.ts";

interface Section {
  section_type: string;
  heading: string;
  content: string;
  order_index: number;
}

async function splitIntoSections(text: string): Promise<Section[]> {
  // Use LLM to identify and split sections
  const textSnippet = text.slice(0, 12000);

  try {
    const result = await chatCompletionJSON(
      `You are an expert in pharmaceutical GMP SOPs. Analyze the given SOP text and split it into its logical sections.

Return JSON with a "sections" array. Each section should have:
- section_type: one of [purpose, scope, responsibilities, procedure, references, definitions, other]
- heading: the section heading as it appears in the document
- content: the full text content of that section (do NOT summarize - include all text)

Important rules:
- Identify ALL sections present in the document
- Common GMP SOP sections: Purpose/Objective, Scope, Definitions, Responsibilities, Procedure/Process, References, Annexures, Abbreviations, Distribution List, Revision History
- Map non-standard headings to the closest section_type (e.g., "Annexures" → other, "Abbreviations" → definitions, "Distribution" → other)
- If a section has sub-sections, keep them together under the parent section
- Preserve the original text content as-is, do not paraphrase
- If the document structure is unclear, split by topic blocks`,
      `SOP Text:\n${textSnippet}`
    );

    if (result.sections && Array.isArray(result.sections)) {
      return result.sections.map((s: any, i: number) => ({
        section_type: s.section_type || "other",
        heading: s.heading || `Section ${i + 1}`,
        content: s.content || "",
        order_index: i,
      }));
    }
  } catch (e) {
    console.error("LLM section split failed, falling back to regex:", e);
  }

  // Fallback: regex-based splitting
  return regexSplit(text);
}

function regexSplit(text: string): Section[] {
  const lines = text.split(/\n/);
  const sections: Section[] = [];
  let currentHeading = "Full Document";
  let currentType = "other";
  let currentContent: string[] = [];
  let orderIndex = 0;

  const typePatterns: Record<string, RegExp> = {
    purpose: /(?:purpose|objective|aim)/i,
    scope: /\bscope\b/i,
    responsibilities: /(?:responsibilit|roles?\s+and|accountabilit)/i,
    procedure: /(?:procedure|process|method|steps?|instructions?)\b/i,
    references: /(?:references?|related\s+documents?|applicable\s+documents?)/i,
    definitions: /(?:definitions?|glossary|abbreviations?|terms?)\b/i,
  };

  function classifyHeading(h: string): string {
    for (const [type, pattern] of Object.entries(typePatterns)) {
      if (pattern.test(h)) return type;
    }
    return "other";
  }

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      currentContent.push("");
      continue;
    }

    // Detect headings: numbered sections, ALL CAPS short lines, or lines ending with colon
    const isHeading =
      trimmed.length < 120 &&
      (/^\d+[\.\)]\s+/.test(trimmed) ||
       /^\d+\.\d+\s+/.test(trimmed) ||
       (trimmed === trimmed.toUpperCase() && trimmed.length > 3 && trimmed.length < 80) ||
       /^[A-Z][A-Z\s&\/,\-]+:?\s*$/.test(trimmed) ||
       /^(?:ANNEXURE|APPENDIX|ATTACHMENT|TABLE)\s/i.test(trimmed));

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

    await supabase
      .from("sop_documents")
      .update({ status: "processing" })
      .eq("id", sop_id);

    const { data: sop, error: sopError } = await supabase
      .from("sop_documents")
      .select("*")
      .eq("id", sop_id)
      .single();

    if (sopError || !sop) {
      throw new Error(`SOP not found: ${sopError?.message}`);
    }

    let rawText = sop.raw_text;

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

    // Split into sections using LLM
    const sections = await splitIntoSections(rawText);

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
