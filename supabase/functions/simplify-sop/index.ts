import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { chatCompletionJSON } from "../_shared/openai.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { sop_id, organization_id } = await req.json();
    if (!sop_id) {
      return new Response(JSON.stringify({ error: "sop_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = getServiceClient();

    const { data: result, error: createErr } = await supabase
      .from("simplification_results")
      .insert({ sop_id, organization_id: organization_id || sop_id, status: "running" })
      .select().single();

    if (createErr) throw new Error(createErr.message);
    const resultId = result.id;

    const { data: sop } = await supabase
      .from("sop_documents")
      .select("id, title, raw_text")
      .eq("id", sop_id).single();

    if (!sop?.raw_text) throw new Error("SOP has no text content");

    const { data: sections } = await supabase
      .from("sop_sections")
      .select("section_type, heading, content")
      .eq("sop_id", sop_id)
      .order("order_index");

    const sectionText = (sections || [])
      .map(s => `[${s.section_type.toUpperCase()}] ${s.heading}\n${s.content}`)
      .join("\n\n---\n\n");

    const sopText = sectionText || sop.raw_text.slice(0, 10000);

    // === LAYER 1: Linguistic ===
    const layer1 = await chatCompletionJSON(
      `You are a pharmaceutical GMP SOP readability expert. Analyze the SOP text for linguistic complexity issues.

Return JSON with:
- score: 0-100 readability score (100 = perfectly simple)
- issues: array of objects, each with:
  - type: "passive_voice" | "long_sentence" | "jargon" | "ambiguous_word" | "complex_structure"
  - severity: "high" | "medium" | "low"
  - location: which section/paragraph
  - original: the problematic text (exact quote, max 100 chars)
  - suggestion: how to rewrite it
  - reason: why this is a problem`,
      `SOP: "${sop.title}"\n\n${sopText.slice(0, 6000)}`
    );

    // === LAYER 2: Structural ===
    const layer2 = await chatCompletionJSON(
      `You are a pharmaceutical GMP SOP structure expert. Analyze how this SOP is organized.

Return JSON with:
- score: 0-100 structural quality score
- issues: array of objects, each with:
  - type: "missing_section" | "bloated_section" | "flat_numbering" | "mixed_content" | "redundant_section" | "poor_ordering"
  - severity: "high" | "medium" | "low"
  - section: which section is affected
  - description: what the structural problem is
  - suggestion: how to restructure`,
      `SOP: "${sop.title}"\n\n${sopText.slice(0, 6000)}`
    );

    // === LAYER 3: Procedural Clarity ===
    const layer3 = await chatCompletionJSON(
      `You are a pharmaceutical GMP SOP procedural clarity expert. Analyze whether the procedure steps are actually executable.

Return JSON with:
- score: 0-100 procedural clarity score
- issues: array of objects, each with:
  - type: "vague_directive" | "missing_acceptance_criteria" | "missing_verification" | "missing_exception_handling" | "undefined_time_constraint" | "missing_reference"
  - severity: "high" | "medium" | "low"
  - step: which step/instruction is affected (quote it)
  - description: what is missing or vague
  - suggestion: how to make it executable
  - audit_risk: why this could be flagged in a GMP audit`,
      `SOP: "${sop.title}"\n\n${sopText.slice(0, 6000)}`
    );

    // === LAYER 4: Role-Action Alignment ===
    const layer4 = await chatCompletionJSON(
      `You are a pharmaceutical GMP SOP role-action alignment expert. Analyze whether every procedural step has a clear, unambiguous actor.

Return JSON with:
- score: 0-100 role-action alignment score
- issues: array of objects, each with:
  - type: "missing_actor" | "ambiguous_actor" | "role_conflict" | "approval_unclear"
  - severity: "high" | "medium" | "low"
  - step: the step text (quote it)
  - description: what's wrong with the role assignment
  - suggestion: who should be the actor and why`,
      `SOP: "${sop.title}"\n\n${sopText.slice(0, 6000)}`
    );

    // === Generate Simplified/Improved SOP Sections ===
    const allIssues = [
      ...(layer1.issues || []).map(i => ({ ...i, layer: "linguistic" })),
      ...(layer2.issues || []).map(i => ({ ...i, layer: "structural" })),
      ...(layer3.issues || []).map(i => ({ ...i, layer: "procedural" })),
      ...(layer4.issues || []).map(i => ({ ...i, layer: "role_action" })),
    ];

    const issuesSummary = allIssues
      .filter(i => i.severity === "high" || i.severity === "medium")
      .map(i => `[${i.layer}/${i.type}] ${i.original || i.step || i.section || ""}: ${i.suggestion || i.description}`)
      .join("\n");

    const simplifiedResult = await chatCompletionJSON(
      `You are a pharmaceutical GMP SOP improvement expert. Given the original SOP sections and the issues found, generate an improved version of each section.

Return JSON with:
- sections: array of objects, each with:
  - heading: the section heading
  - section_type: the section type
  - original: the original text (verbatim, complete)
  - improved: the improved/rewritten text incorporating all fixes
  - changes: array of strings, each describing one specific change made (e.g., "Changed passive voice 'samples shall be collected' to active 'QC Analyst shall collect samples'", "Added acceptance criteria for temperature check", "Specified actor for step 3")

Rules:
- Keep the improved text as close to the original as possible — only change what needs fixing
- Every change must address a specific issue from the analysis
- Do NOT add new content that wasn't implied by the original
- Preserve all technical accuracy
- Use "shall" for mandatory actions, never "should" or "may" for required steps
- Every procedural step must have an explicit actor`,
      `SOP: "${sop.title}"\n\nOriginal Sections:\n${sopText.slice(0, 5000)}\n\nIssues Found:\n${issuesSummary.slice(0, 3000)}`
    );

    // Calculate overall score
    const scores = [layer1.score || 0, layer2.score || 0, layer3.score || 0, layer4.score || 0];
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / 4);

    const highCount = allIssues.filter(i => i.severity === "high").length;
    const medCount = allIssues.filter(i => i.severity === "medium").length;
    const weakest = scores.indexOf(Math.min(...scores));
    const weakestLabel = ["Linguistic", "Structural", "Procedural Clarity", "Role-Action"][weakest];
    const overallSummary = `${allIssues.length} issues found (${highCount} high, ${medCount} medium). Weakest area: ${weakestLabel}.`;

    await supabase.from("simplification_results").update({
      status: "completed",
      overall_score: overallScore,
      overall_summary: overallSummary,
      linguistic_score: layer1.score || 0,
      linguistic_issues: layer1.issues || [],
      structural_score: layer2.score || 0,
      structural_issues: layer2.issues || [],
      procedural_score: layer3.score || 0,
      procedural_issues: layer3.issues || [],
      role_action_score: layer4.score || 0,
      role_action_issues: layer4.issues || [],
      simplified_sections: simplifiedResult.sections || [],
      completed_at: new Date().toISOString(),
    }).eq("id", resultId);

    return new Response(JSON.stringify({
      success: true, result_id: resultId, overall_score: overallScore, summary: overallSummary,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("simplify-sop error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
