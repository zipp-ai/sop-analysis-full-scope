import supabase from '../supabase';
import edgeFunctionService from './edgeFunctionService';

const simplificationService = {
  async runSimplification(sopId, organizationId) {
    return edgeFunctionService.simplifySOP(sopId, organizationId);
  },

  async getResults(organizationId) {
    const { data, error } = await supabase
      .from('simplification_results')
      .select('*, sop:sop_documents(id, title, sop_code, department, site, category:sop_categories(category_name))')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data;
  },

  async getResult(resultId) {
    const { data, error } = await supabase
      .from('simplification_results')
      .select('*, sop:sop_documents(id, title, sop_code, department, site, category:sop_categories(category_name))')
      .eq('id', resultId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  async deleteResult(resultId) {
    const { error } = await supabase
      .from('simplification_results')
      .delete()
      .eq('id', resultId);

    if (error) throw new Error(error.message);
  },
};

export default simplificationService;
