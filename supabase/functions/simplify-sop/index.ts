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

    // Create result record
    const { data: result, error: createErr } = await supabase
      .from("simplification_results")
      .insert({ sop_id, organization_id: organization_id || sop_id, status: "running" })
      .select().single();

    if (createErr) throw new Error(createErr.message);
    const resultId = result.id;

    // Get SOP with sections
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

    // === LAYER 1: Linguistic Simplification ===
    const layer1 = await chatCompletionJSON(
      `You are a pharmaceutical GMP SOP readability expert. Analyze the SOP text for linguistic complexity issues.

Return JSON with:
- score: 0-100 readability score (100 = perfectly simple)
- issues: array of objects, each with:
  - type: "passive_voice" | "long_sentence" | "jargon" | "ambiguous_word" | "complex_structure"
  - severity: "high" | "medium" | "low"
  - location: which section/paragraph this was found in
  - original: the problematic text (exact quote, max 100 chars)
  - suggestion: how to rewrite it
  - reason: why this is a problem for SOP users

Focus on:
- Passive voice ("samples shall be collected" → "QC analyst shall collect samples")
- Sentences over 30 words
- Ambiguous words: "approximately", "as needed", "may", "should" vs "shall", "ensure", "adequate"
- Unnecessary jargon that could be simplified without losing precision
- Complex sentence structures that could be broken into simpler steps`,
      `SOP: "${sop.title}"\n\n${sopText.slice(0, 6000)}`
    );

    // === LAYER 2: Structural Simplification ===
    const layer2 = await chatCompletionJSON(
      `You are a pharmaceutical GMP SOP structure expert. Analyze how this SOP is organized.

Return JSON with:
- score: 0-100 structural quality score (100 = perfectly structured)
- issues: array of objects, each with:
  - type: "missing_section" | "bloated_section" | "flat_numbering" | "mixed_content" | "redundant_section" | "poor_ordering"
  - severity: "high" | "medium" | "low"
  - section: which section is affected
  - description: what the structural problem is
  - suggestion: how to restructure

Check for:
- Missing standard GMP sections (Purpose, Scope, Definitions, Responsibilities, Procedure, References)
- Procedure section with too many flat steps (>15) that should have sub-steps
- Responsibilities mixed into Procedure instead of a clear RACI or matrix
- Purpose section that is too long (should be 2-3 sentences max)
- Scope that doesn't clearly define boundaries (what's in vs out)
- Definitions section missing for technical terms used in Procedure
- Steps in wrong logical order`,
      `SOP: "${sop.title}"\n\n${sopText.slice(0, 6000)}`
    );

    // === LAYER 3: Procedural Clarity ===
    const layer3 = await chatCompletionJSON(
      `You are a pharmaceutical GMP SOP procedural clarity expert. Analyze whether the procedure steps are actually executable by a shop-floor operator.

Return JSON with:
- score: 0-100 procedural clarity score (100 = every step is unambiguously executable)
- issues: array of objects, each with:
  - type: "vague_directive" | "missing_acceptance_criteria" | "missing_verification" | "missing_exception_handling" | "undefined_time_constraint" | "missing_reference"
  - severity: "high" | "medium" | "low"
  - step: which step/instruction is affected (quote it)
  - description: what is missing or vague
  - suggestion: how to make it executable
  - audit_risk: why this could be flagged in a GMP audit

Focus on:
- "Ensure equipment is clean" → what standard defines clean? how to verify? what if not clean?
- "Record the results" → where? in what format? who reviews?
- "Approximately X minutes" → what is the acceptable range?
- "If required" / "as needed" → what triggers this? who decides?
- Missing hold times, temperature ranges, or acceptance criteria
- Steps that reference other SOPs without specifying which section`,
      `SOP: "${sop.title}"\n\n${sopText.slice(0, 6000)}`
    );

    // === LAYER 4: Role-Action Alignment ===
    const layer4 = await chatCompletionJSON(
      `You are a pharmaceutical GMP SOP role-action alignment expert. Analyze whether every procedural step has a clear, unambiguous actor (who does it).

Return JSON with:
- score: 0-100 role-action alignment score (100 = every step has explicit actor)
- issues: array of objects, each with:
  - type: "missing_actor" | "ambiguous_actor" | "role_conflict" | "approval_unclear"
  - severity: "high" | "medium" | "low"
  - step: the step text (quote it)
  - description: what's wrong with the role assignment
  - suggestion: who should be the actor and why
- role_action_matrix: array of objects representing the procedure as actor-action pairs:
  - step_number: integer
  - actor: who performs this step (role/title)
  - action: what they do (verb phrase)
  - output: what this step produces or changes
  - approver: who approves/verifies (if applicable, else null)

Focus on:
- Steps using passive voice with no subject ("samples are collected" — by whom?)
- Steps where "the department" or "the team" is the actor instead of a specific role
- Approval/sign-off steps that don't specify who has authority
- Handoff points between roles that aren't explicit`,
      `SOP: "${sop.title}"\n\n${sopText.slice(0, 6000)}`
    );

    // === Generate Flowchart from Role-Action Matrix ===
    let flowchartMermaid = "";
    if (layer4.role_action_matrix && layer4.role_action_matrix.length > 0) {
      try {
        const fcResult = await chatCompletionJSON(
          `Generate a Mermaid flowchart from the given role-action matrix. Use swim lanes (subgraph) for each unique actor/role.

Return JSON with:
- mermaid: the Mermaid flowchart code as a string. Use "graph TD" format.
  Keep it clean — max 20 nodes. Combine trivial steps. Use short labels.`,
          `Role-Action Matrix:\n${JSON.stringify(layer4.role_action_matrix, null, 2)}`
        );
        flowchartMermaid = fcResult.mermaid || "";
      } catch (e) {
        console.error("Flowchart generation failed:", e);
      }
    }

    // Calculate overall score
    const scores = [layer1.score || 0, layer2.score || 0, layer3.score || 0, layer4.score || 0];
    const overallScore = Math.round(scores.reduce((a, b) => a + b, 0) / 4);

    // Count total issues by severity
    const allIssues = [
      ...(layer1.issues || []),
      ...(layer2.issues || []),
      ...(layer3.issues || []),
      ...(layer4.issues || []),
    ];
    const highCount = allIssues.filter(i => i.severity === "high").length;
    const medCount = allIssues.filter(i => i.severity === "medium").length;
    const overallSummary = `${allIssues.length} issues found (${highCount} high, ${medCount} medium). Weakest area: ${
      scores.indexOf(Math.min(...scores)) === 0 ? "Linguistic" :
      scores.indexOf(Math.min(...scores)) === 1 ? "Structural" :
      scores.indexOf(Math.min(...scores)) === 2 ? "Procedural Clarity" : "Role-Action Alignment"
    }.`;

    // Update result
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
      role_action_matrix: layer4.role_action_matrix || [],
      flowchart_mermaid: flowchartMermaid,
      completed_at: new Date().toISOString(),
    }).eq("id", resultId);

    return new Response(JSON.stringify({
      success: true,
      result_id: resultId,
      overall_score: overallScore,
      summary: overallSummary,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("simplify-sop error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
