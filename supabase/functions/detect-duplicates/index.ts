import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { chatCompletionJSON } from "../_shared/openai.ts";
import { corsHeaders } from "../_shared/cors.ts";

function levenshteinRatio(a: string, b: string): number {
  const la = a.toLowerCase();
  const lb = b.toLowerCase();
  if (la === lb) return 1;

  const matrix: number[][] = [];
  for (let i = 0; i <= la.length; i++) {
    matrix[i] = [i];
    for (let j = 1; j <= lb.length; j++) {
      matrix[i][j] =
        i === 0
          ? j
          : Math.min(
              matrix[i - 1][j] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j - 1] + (la[i - 1] === lb[j - 1] ? 0 : 1)
            );
    }
  }

  const maxLen = Math.max(la.length, lb.length);
  return maxLen === 0 ? 1 : 1 - matrix[la.length][lb.length] / maxLen;
}

interface SOPDoc {
  id: string;
  title: string;
  sop_code: string | null;
  version: string | null;
  department: string | null;
  raw_text: string | null;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organization_id, name, category_id, sop_ids } = await req.json();
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getServiceClient();

    // Get SOPs — filtered by provided IDs if given, otherwise all ready SOPs
    let query = supabase
      .from("sop_documents")
      .select("id, title, sop_code, version, department, category_id")
      .eq("organization_id", organization_id)
      .eq("status", "ready");

    if (sop_ids && sop_ids.length > 0) {
      query = query.in("id", sop_ids);
    } else if (category_id) {
      query = query.eq("category_id", category_id);
    }

    const { data: sops, error: sopError } = await query;

    if (sopError) throw new Error(`Fetch SOPs error: ${sopError.message}`);
    if (!sops || sops.length < 2) {
      return new Response(
        JSON.stringify({ error: "Need at least 2 processed SOPs to detect duplicates" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create analysis record
    const { data: analysis, error: analysisError } = await supabase
      .from("duplicate_analyses")
      .insert({
        organization_id,
        name: name || null,
        category_id: category_id || null,
        status: "running_layer1",
        total_sops: sops.length,
      })
      .select()
      .single();

    if (analysisError) throw new Error(`Analysis create error: ${analysisError.message}`);
    const analysisId = analysis.id;

    // === LAYER 1: Title Fuzzy Match — build candidate pairs ===
    const candidatePairs: Array<{
      sop_a: SOPDoc;
      sop_b: SOPDoc;
      metadata_score: number;
    }> = [];

    for (let i = 0; i < sops.length; i++) {
      for (let j = i + 1; j < sops.length; j++) {
        // Only compare SOPs within the same category
        const sameCategory =
          sops[i].category_id && sops[j].category_id &&
          sops[i].category_id === sops[j].category_id;
        const bothUncategorized = !sops[i].category_id && !sops[j].category_id;

        if (!sameCategory && !bothUncategorized) continue;

        const titleSim = levenshteinRatio(sops[i].title, sops[j].title);
        let codeSim = 0;
        if (sops[i].sop_code && sops[j].sop_code) {
          codeSim = levenshteinRatio(sops[i].sop_code, sops[j].sop_code);
        }
        const sameDept =
          sops[i].department && sops[j].department &&
          sops[i].department.toLowerCase() === sops[j].department.toLowerCase()
            ? 0.1 : 0;

        const metadataScore = Math.min(Math.max(titleSim, codeSim) + sameDept, 1);

        candidatePairs.push({
          sop_a: sops[i],
          sop_b: sops[j],
          metadata_score: Math.round(metadataScore * 100) / 100,
        });
      }
    }

    // === LAYER 2: Semantic Similarity via DB function (no embedding loading) ===
    await supabase
      .from("duplicate_analyses")
      .update({ status: "running_layer2" })
      .eq("id", analysisId);

    const scoredPairs: Array<any> = [];

    for (const pair of candidatePairs) {
      // Use DB functions for embedding-based similarity (avoids loading vectors into JS memory)
      const { data: simResult } = await supabase
        .rpc("compute_section_similarity", {
          sop_a: pair.sop_a.id,
          sop_b: pair.sop_b.id,
        });

      const semanticScore = Math.round((simResult || 0) * 100) / 100;

      // Get per-section similarity pairs from DB (embedding cosine similarity)
      const { data: sectionPairs } = await supabase
        .rpc("compute_section_pairs", {
          sop_a_id: pair.sop_a.id,
          sop_b_id: pair.sop_b.id,
        });

      const overlapping = (sectionPairs || []).map((sp: any) => {
        const sim = Math.round((sp.similarity || 0) * 100) / 100;
        return {
          section_a: sp.section_a_type ? {
            type: sp.section_a_type,
            heading: sp.section_a_heading,
            content_preview: sp.section_a_content_preview,
          } : null,
          section_b: sp.section_b_type ? {
            type: sp.section_b_type,
            heading: sp.section_b_heading,
            content_preview: sp.section_b_content_preview,
          } : null,
          similarity: sim,
          status: sim > 0.92 ? "identical" : sim > 0.8 ? "similar" : sim > 0.6 ? "partial" : sp.section_a_type ? "different" : "only_in_b",
        };
      });

      // Scope overlap from section pairs
      const scopePair = overlapping.find((o: any) =>
        o.section_a?.type === "scope" && o.section_b?.type === "scope"
      );
      const scopeOverlap = scopePair ? scopePair.similarity : 0;

      scoredPairs.push({
        ...pair,
        semantic_score: semanticScore,
        scope_overlap_score: Math.round(scopeOverlap * 100) / 100,
        overlapping_sections: overlapping,
      });
    }

    // === LAYER 3: LLM Classification for high-scoring pairs ===
    await supabase
      .from("duplicate_analyses")
      .update({ status: "running_layer3" })
      .eq("id", analysisId);

    const pairsToInsert = [];

    for (const pair of scoredPairs) {
      const needsLLM =
        pair.semantic_score > 0.7 ||
        pair.metadata_score > 0.8 ||
        pair.scope_overlap_score > 0.8;

      let llmClassification = null;
      let recommendedAction = null;
      let llmReasoning = null;

      if (needsLLM) {
        try {
          // Fetch raw_text only for LLM pairs (saves memory)
          const { data: sopAData } = await supabase
            .from("sop_documents")
            .select("raw_text")
            .eq("id", pair.sop_a.id)
            .single();
          const { data: sopBData } = await supabase
            .from("sop_documents")
            .select("raw_text")
            .eq("id", pair.sop_b.id)
            .single();

          const textA = (sopAData?.raw_text || "").slice(0, 3000);
          const textB = (sopBData?.raw_text || "").slice(0, 3000);

          const result = await chatCompletionJSON(
            `You are a GMP/pharmaceutical SOP analyst. Compare two SOPs and classify their relationship. Respond in JSON with: classification (full_duplicate | partial_overlap | version_variant | distinct), recommended_action (retire | merge | split | version_consolidate | review | none), reasoning (2-3 sentences explaining your assessment).`,
            `SOP A: "${pair.sop_a.title}" (Code: ${pair.sop_a.sop_code || "N/A"}, Version: ${pair.sop_a.version || "N/A"}, Dept: ${pair.sop_a.department || "N/A"})\n\nContent:\n${textA}\n\n---\n\nSOP B: "${pair.sop_b.title}" (Code: ${pair.sop_b.sop_code || "N/A"}, Version: ${pair.sop_b.version || "N/A"}, Dept: ${pair.sop_b.department || "N/A"})\n\nContent:\n${textB}`
          );

          llmClassification = result.classification;
          recommendedAction = result.recommended_action;
          llmReasoning = result.reasoning;
        } catch (e) {
          console.error("LLM analysis failed for pair:", e);
          llmReasoning = `LLM analysis failed: ${e.message}`;
        }
      }

      if (!llmClassification) {
        const maxScore = Math.max(pair.metadata_score, pair.semantic_score);
        if (maxScore > 0.92) {
          llmClassification = "full_duplicate";
          recommendedAction = "retire";
        } else if (maxScore > 0.7) {
          llmClassification = "partial_overlap";
          recommendedAction = "review";
        } else {
          llmClassification = "distinct";
          recommendedAction = "none";
        }
      }

      pairsToInsert.push({
        analysis_id: analysisId,
        sop_a_id: pair.sop_a.id,
        sop_b_id: pair.sop_b.id,
        metadata_score: pair.metadata_score,
        semantic_score: pair.semantic_score,
        scope_overlap_score: pair.scope_overlap_score,
        llm_classification: llmClassification,
        recommended_action: recommendedAction,
        overlapping_sections: pair.overlapping_sections,
        llm_reasoning: llmReasoning,
      });
    }

    // Insert pairs
    if (pairsToInsert.length > 0) {
      const { error: pairError } = await supabase
        .from("duplicate_pairs")
        .insert(pairsToInsert);
      if (pairError) throw new Error(`Pair insert error: ${pairError.message}`);
    }

    // Build clusters
    const flaggedPairs = pairsToInsert.filter(
      (p) => p.llm_classification !== "distinct"
    );

    const parent: Record<string, string> = {};
    function find(x: string): string {
      if (!parent[x]) parent[x] = x;
      if (parent[x] !== x) parent[x] = find(parent[x]);
      return parent[x];
    }
    function union(a: string, b: string) {
      parent[find(a)] = find(b);
    }

    for (const p of flaggedPairs) {
      union(p.sop_a_id, p.sop_b_id);
    }

    const clusterMap: Record<string, Set<string>> = {};
    for (const p of flaggedPairs) {
      const root = find(p.sop_a_id);
      if (!clusterMap[root]) clusterMap[root] = new Set();
      clusterMap[root].add(p.sop_a_id);
      clusterMap[root].add(p.sop_b_id);
    }

    const sopTitleMap: Record<string, string> = {};
    for (const s of sops) sopTitleMap[s.id] = s.title;

    const clusters = Object.values(clusterMap).map((sopSet, i) => {
      const ids = Array.from(sopSet);
      const titles = ids.map((id) => sopTitleMap[id] || "Unknown").join(", ");
      return {
        analysis_id: analysisId,
        cluster_name: `Cluster ${i + 1}: ${titles.slice(0, 100)}`,
        sop_ids: ids,
        recommended_action: "review",
      };
    });

    if (clusters.length > 0) {
      const { error: clusterError } = await supabase
        .from("duplicate_clusters")
        .insert(clusters);
      if (clusterError) throw new Error(`Cluster insert error: ${clusterError.message}`);
    }

    // Finalize
    await supabase
      .from("duplicate_analyses")
      .update({
        status: "completed",
        total_pairs: pairsToInsert.length,
        flagged_pairs: flaggedPairs.length,
        cluster_count: clusters.length,
        completed_at: new Date().toISOString(),
      })
      .eq("id", analysisId);

    return new Response(
      JSON.stringify({
        success: true,
        analysis_id: analysisId,
        total_sops: sops.length,
        total_pairs: pairsToInsert.length,
        flagged_pairs: flaggedPairs.length,
        clusters: clusters.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("detect-duplicates error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
