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

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

interface SOPDoc {
  id: string;
  title: string;
  sop_code: string | null;
  version: string | null;
  department: string | null;
  raw_text: string | null;
}

interface SectionData {
  sop_id: string;
  section_type: string;
  heading: string;
  content: string;
  embedding: number[];
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(
        JSON.stringify({ error: "organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = getServiceClient();

    // Get all ready SOPs for this org
    const { data: sops, error: sopError } = await supabase
      .from("sop_documents")
      .select("id, title, sop_code, version, department, raw_text")
      .eq("organization_id", organization_id)
      .eq("status", "ready");

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
        status: "running_layer1",
        total_sops: sops.length,
      })
      .select()
      .single();

    if (analysisError) throw new Error(`Analysis create error: ${analysisError.message}`);

    const analysisId = analysis.id;

    // === LAYER 1: Metadata/Title Fuzzy Match ===
    const candidatePairs: Array<{
      sop_a: SOPDoc;
      sop_b: SOPDoc;
      metadata_score: number;
    }> = [];

    for (let i = 0; i < sops.length; i++) {
      for (let j = i + 1; j < sops.length; j++) {
        const titleSim = levenshteinRatio(sops[i].title, sops[j].title);

        let codeSim = 0;
        if (sops[i].sop_code && sops[j].sop_code) {
          codeSim = levenshteinRatio(sops[i].sop_code, sops[j].sop_code);
        }

        const sameDept =
          sops[i].department &&
          sops[j].department &&
          sops[i].department.toLowerCase() === sops[j].department.toLowerCase()
            ? 0.1
            : 0;

        const metadataScore = Math.max(titleSim, codeSim) + sameDept;

        if (metadataScore > 0.5 || sops.length <= 20) {
          candidatePairs.push({
            sop_a: sops[i],
            sop_b: sops[j],
            metadata_score: Math.min(metadataScore, 1),
          });
        }
      }
    }

    // === LAYER 2: Semantic Similarity via Embeddings ===
    await supabase
      .from("duplicate_analyses")
      .update({ status: "running_layer2" })
      .eq("id", analysisId);

    // Fetch all sections with embeddings
    const sopIds = sops.map((s) => s.id);
    const { data: allSections, error: secError } = await supabase
      .from("sop_sections")
      .select("sop_id, section_type, heading, content, embedding")
      .in("sop_id", sopIds);

    if (secError) throw new Error(`Fetch sections error: ${secError.message}`);

    const sectionsBySop: Record<string, SectionData[]> = {};
    for (const sec of allSections || []) {
      if (!sectionsBySop[sec.sop_id]) sectionsBySop[sec.sop_id] = [];
      sectionsBySop[sec.sop_id].push(sec);
    }

    // Compute semantic similarity for candidate pairs
    const scoredPairs: Array<{
      sop_a: SOPDoc;
      sop_b: SOPDoc;
      metadata_score: number;
      semantic_score: number;
      scope_overlap_score: number;
      overlapping_sections: any[];
    }> = [];

    for (const pair of candidatePairs) {
      const sectionsA = sectionsBySop[pair.sop_a.id] || [];
      const sectionsB = sectionsBySop[pair.sop_b.id] || [];

      if (sectionsA.length === 0 || sectionsB.length === 0) {
        scoredPairs.push({
          ...pair,
          semantic_score: 0,
          scope_overlap_score: 0,
          overlapping_sections: [],
        });
        continue;
      }

      // Compute best-match similarity between sections
      let totalSim = 0;
      let count = 0;
      const overlapping: any[] = [];

      for (const a of sectionsA) {
        if (!a.embedding) continue;
        let bestSim = 0;
        let bestMatch: SectionData | null = null;

        for (const b of sectionsB) {
          if (!b.embedding) continue;
          const sim = cosineSimilarity(a.embedding, b.embedding);
          if (sim > bestSim) {
            bestSim = sim;
            bestMatch = b;
          }
        }

        totalSim += bestSim;
        count++;

        if (bestSim > 0.8 && bestMatch) {
          overlapping.push({
            section_a: { type: a.section_type, heading: a.heading },
            section_b: { type: bestMatch.section_type, heading: bestMatch.heading },
            similarity: Math.round(bestSim * 100) / 100,
          });
        }
      }

      const semanticScore = count > 0 ? totalSim / count : 0;

      // Scope overlap: specifically compare scope sections
      const scopeA = sectionsA.find((s) => s.section_type === "scope");
      const scopeB = sectionsB.find((s) => s.section_type === "scope");
      let scopeOverlap = 0;
      if (scopeA?.embedding && scopeB?.embedding) {
        scopeOverlap = cosineSimilarity(scopeA.embedding, scopeB.embedding);
      }

      scoredPairs.push({
        ...pair,
        semantic_score: Math.round(semanticScore * 100) / 100,
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
    const llmThreshold = 0.75;

    for (const pair of scoredPairs) {
      const needsLLM =
        pair.semantic_score > llmThreshold ||
        pair.metadata_score > 0.85 ||
        pair.scope_overlap_score > 0.85;

      let llmClassification = null;
      let recommendedAction = null;
      let llmReasoning = null;

      if (needsLLM) {
        try {
          const textA = (pair.sop_a.raw_text || "").slice(0, 3000);
          const textB = (pair.sop_b.raw_text || "").slice(0, 3000);

          const result = await chatCompletionJSON(
            `You are a GMP/pharmaceutical SOP analyst. Compare two SOPs and classify their relationship. Respond in JSON with: classification (full_duplicate | partial_overlap | version_variant | distinct), recommended_action (retire | merge | split | version_consolidate | review | none), reasoning (2-3 sentences explaining your assessment).`,
            `SOP A: "${pair.sop_a.title}" (Code: ${pair.sop_a.sop_code || "N/A"}, Version: ${pair.sop_a.version || "N/A"}, Dept: ${pair.sop_a.department || "N/A"})\n\nContent:\n${textA}\n\n---\n\nSOP B: "${pair.sop_b.title}" (Code: ${pair.sop_b.sop_code || "N/A"}, Version: ${pair.sop_b.version || "N/A"}, Dept: ${pair.sop_b.department || "N/A"})\n\nContent:\n${textB}`,
            "gpt-4o-mini"
          );

          llmClassification = result.classification;
          recommendedAction = result.recommended_action;
          llmReasoning = result.reasoning;
        } catch (e) {
          console.error("LLM analysis failed for pair:", e);
          llmReasoning = `LLM analysis failed: ${e.message}`;
        }
      }

      // For pairs without LLM, classify based on scores
      if (!llmClassification) {
        const maxScore = Math.max(pair.metadata_score, pair.semantic_score);
        if (maxScore > 0.92) {
          llmClassification = "full_duplicate";
          recommendedAction = "retire";
        } else if (maxScore > 0.75) {
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

    // Insert all pairs
    if (pairsToInsert.length > 0) {
      const { error: pairError } = await supabase
        .from("duplicate_pairs")
        .insert(pairsToInsert);
      if (pairError) throw new Error(`Pair insert error: ${pairError.message}`);
    }

    // Build clusters using union-find on pairs with classification != 'distinct'
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

    // Group SOPs by cluster root
    const clusterMap: Record<string, Set<string>> = {};
    for (const p of flaggedPairs) {
      const root = find(p.sop_a_id);
      if (!clusterMap[root]) clusterMap[root] = new Set();
      clusterMap[root].add(p.sop_a_id);
      clusterMap[root].add(p.sop_b_id);
    }

    // Create cluster records
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
      if (clusterError)
        throw new Error(`Cluster insert error: ${clusterError.message}`);
    }

    // Finalize analysis
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
