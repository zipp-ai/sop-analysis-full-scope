import supabase from '../supabase';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;

async function callEdgeFunction(functionName, body) {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;

  const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'apikey': process.env.REACT_APP_SUPABASE_ANON_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(error.error || 'Edge function call failed');
  }

  return response.json();
}

const edgeFunctionService = {
  processSOP: (sopId) => callEdgeFunction('process-sop', { sop_id: sopId }),
  detectDuplicates: (organizationId) => callEdgeFunction('detect-duplicates', { organization_id: organizationId }),
  extractMetadata: (rawText, fileName) => callEdgeFunction('extract-metadata', { raw_text: rawText, file_name: fileName }),
  simplifySOP: (sopId, organizationId) => callEdgeFunction('simplify-sop', { sop_id: sopId, organization_id: organizationId }),
};

export default edgeFunctionService;
