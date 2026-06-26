import supabase from '../supabase';
import edgeFunctionService from './edgeFunctionService';

const duplicateService = {
  // Upload and process a new SOP for the analysis pipeline
  // Get all SOP categories
  async getCategories() {
    const { data, error } = await supabase
      .from('sop_categories')
      .select('*')
      .order('category_name');

    if (error) throw new Error(error.message);
    return data;
  },

  async uploadSOP({ title, sopCode, version, effectiveDate, department, site, categoryId, fileUrl, rawText, organizationId, userId }) {
    const { data, error } = await supabase
      .from('sop_documents')
      .insert({
        title,
        sop_code: sopCode || null,
        version: version || null,
        effective_date: effectiveDate || null,
        department: department || null,
        site: site || 'Global',
        category_id: categoryId || null,
        file_url: fileUrl,
        raw_text: rawText,
        organization_id: organizationId,
        user_id: userId,
        status: 'pending',
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Trigger SOP processing (text extraction + embeddings)
  async processSOP(sopId) {
    return edgeFunctionService.processSOP(sopId);
  },

  // Get all SOP documents for an org
  async getSOPDocuments(organizationId) {
    const { data, error } = await supabase
      .from('sop_documents')
      .select('*, category:sop_categories(category_name)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  // Run duplicate detection analysis
  async runAnalysis(organizationId, { name, categoryId, sopIds } = {}) {
    return edgeFunctionService.detectDuplicates(organizationId, { name, category_id: categoryId, sop_ids: sopIds });
  },

  // Get all analyses for an org
  async getAnalyses(organizationId) {
    const { data, error } = await supabase
      .from('duplicate_analyses')
      .select('*, category:sop_categories(category_name)')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  // Get a single analysis
  async getAnalysis(analysisId) {
    const { data, error } = await supabase
      .from('duplicate_analyses')
      .select('*')
      .eq('id', analysisId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Get pairs for an analysis
  async getPairs(analysisId) {
    const { data, error } = await supabase
      .from('duplicate_pairs')
      .select('*')
      .eq('analysis_id', analysisId);

    if (error) throw new Error(error.message);

    // Sort by overall_score descending
    return (data || []).sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0));
  },

  // Get clusters for an analysis
  async getClusters(analysisId) {
    const { data, error } = await supabase
      .from('duplicate_clusters')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  },

  // Update user decision on a pair
  async updatePairDecision(pairId, decision, notes = '') {
    const { data, error } = await supabase
      .from('duplicate_pairs')
      .update({ user_decision: decision, user_decision_notes: notes })
      .eq('id', pairId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Update SOP document metadata
  async updateSOPDocument(sopId, updates) {
    const { data, error } = await supabase
      .from('sop_documents')
      .update({
        title: updates.title,
        sop_code: updates.sop_code || null,
        version: updates.version || null,
        department: updates.department || null,
        site: updates.site || 'Global',
        category_id: updates.category_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sopId)
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Delete an analysis and all its pairs/clusters
  async deleteAnalysis(analysisId) {
    const { error } = await supabase
      .from('duplicate_analyses')
      .delete()
      .eq('id', analysisId);

    if (error) throw new Error(error.message);
  },

  // Delete all analyses for an org
  async deleteAllAnalyses(organizationId) {
    const { error } = await supabase
      .from('duplicate_analyses')
      .delete()
      .eq('organization_id', organizationId);

    if (error) throw new Error(error.message);
  },

  // Delete a SOP document
  async deleteSOPDocument(sopId) {
    const { error } = await supabase
      .from('sop_documents')
      .delete()
      .eq('id', sopId);

    if (error) throw new Error(error.message);
  },
};

export default duplicateService;
