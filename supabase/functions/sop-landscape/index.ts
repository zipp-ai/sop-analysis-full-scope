import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { getServiceClient } from "../_shared/supabase.ts";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { organization_id } = await req.json();
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = getServiceClient();

    // Get all ready SOPs
    const { data: sops } = await supabase
      .from("sop_documents")
      .select("id, title, sop_code, department, site, version, category_id, category:sop_categories(category_name)")
      .eq("organization_id", organization_id)
      .eq("status", "ready");

    if (!sops || sops.length === 0) {
      return new Response(JSON.stringify({ nodes: [], edges: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get averaged embedding per SOP using DB
    const nodes = [];
    for (const sop of sops) {
      const { data: sections } = await supabase
        .from("sop_sections")
        .select("embedding")
        .eq("sop_id", sop.id)
        .not("embedding", "is", null);

      let avgEmbedding: number[] | null = null;
      if (sections && sections.length > 0) {
        const dim = sections[0].embedding.length;
        avgEmbedding = new Array(dim).fill(0);
        for (const sec of sections) {
          for (let i = 0; i < dim; i++) {
            avgEmbedding[i] += sec.embedding[i];
          }
        }
        for (let i = 0; i < dim; i++) {
          avgEmbedding[i] /= sections.length;
        }
      }

      // Count versions (how many SOPs share the same sop_code)
      let versionCount = 1;
      if (sop.sop_code) {
        const { count } = await supabase
          .from("sop_documents")
          .select("id", { count: "exact", head: true })
          .eq("sop_code", sop.sop_code)
          .eq("organization_id", organization_id);
        versionCount = count || 1;
      }

      nodes.push({
        sop_id: sop.id,
        title: sop.title,
        sop_code: sop.sop_code,
        functional_area: sop.category?.category_name || "Uncategorized",
        category_id: sop.category_id,
        site_name: sop.site || "Global",
        document_type: (sop.site && sop.site !== "Global") ? "site" : "global",
        version_count: versionCount,
        department: sop.department,
        embedding: avgEmbedding,
      });
    }

    // Get discovered edges from duplicate_pairs
    const sopIds = sops.map(s => s.id);
    const { data: pairs } = await supabase
      .from("duplicate_pairs")
      .select("sop_a_id, sop_b_id, semantic_score, metadata_score, llm_classification")
      .or(`sop_a_id.in.(${sopIds.join(",")}),sop_b_id.in.(${sopIds.join(",")})`)
      .gt("semantic_score", 0.3);

    const edges = (pairs || []).map(p => ({
      source: p.sop_a_id,
      target: p.sop_b_id,
      similarity_score: Math.max(p.semantic_score || 0, p.metadata_score || 0),
      type: "discovered",
      classification: p.llm_classification,
    }));

    // Get declared references from sop_sections (references section mentioning other SOP codes)
    // For now, we extract from section content matching SOP codes
    const sopCodes = sops.filter(s => s.sop_code).map(s => ({ id: s.id, code: s.sop_code }));
    const declaredEdges: any[] = [];

    if (sopCodes.length > 0) {
      for (const sop of sops) {
        const { data: refSections } = await supabase
          .from("sop_sections")
          .select("content")
          .eq("sop_id", sop.id)
          .eq("section_type", "references");

        if (refSections) {
          const refText = refSections.map(s => s.content).join(" ").toUpperCase();
          for (const other of sopCodes) {
            if (other.id !== sop.id && other.code && refText.includes(other.code.toUpperCase())) {
              declaredEdges.push({
                source: sop.id,
                target: other.id,
                type: "declared",
              });
            }
          }
        }
      }
    }

    return new Response(JSON.stringify({
      nodes: nodes.map(n => ({ ...n, embedding: n.embedding })),
      discovered_edges: edges,
      declared_edges: declaredEdges,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error("sop-landscape error:", error);
    return new Response(JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
