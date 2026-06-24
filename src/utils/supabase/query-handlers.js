import { supabase } from "./client";

/**
 * Fetch all vendors ordered by name
 * @param {string} [fromDate] - Optional ISO string for start date filter
 * @param {string} [toDate] - Optional ISO string for end date filter
 * @returns {Promise<import('../../components/pages/batch-review/types').Vendor[]>}
 */
export async function getVendors(fromDate, toDate) {
  let query = supabase.from("cdmos").select("*").order("name");

  // Date filter disabled for now
  // if (fromDate) {
  //   query = query.gte("created_at", fromDate);
  // }

  // if (toDate) {
  //   query = query.lte("created_at", toDate);
  // }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching vendors:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch all products ordered by name
 * @param {string} [fromDate] - Optional ISO string for start date filter
 * @param {string} [toDate] - Optional ISO string for end date filter
 * @returns {Promise<import('../../components/pages/batch-review/types').Product[]>}
 */
export async function getProducts(fromDate, toDate) {
  let query = supabase.from("drugs").select("*").order("name");

  // Date filter disabled for now
  // if (fromDate) {
  //   query = query.gte("created_at", fromDate);
  // }

  // if (toDate) {
  //   query = query.lte("created_at", toDate);
  // }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching products:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch all batch records with joined vendor and product data
 * @returns {Promise<import('../../components/pages/batch-review/types').BatchRecord[]>}
 */
export async function getBatchRecords() {
  const { data, error } = await supabase.from("bmrs").select(
    `
    *,
    cdmos (id, name),
    drugs (id, name),
    batch_record_deviations (count),
    mbrs!inner (
      mbr_spec_draft_fields (expected_value, label)
    )
  `
  );

  if (error) {
    console.error("Error fetching batch records:", error);
    throw error;
  }

  return data || [];
}

/**
 * Fetch filtered batch records based on manufacturing_date date range
 * Also filters for specific batch label fields similar to getBatchRecordsWithBatchLabel
 * @param {string} fromDate - ISO string for start date
 * @param {string} toDate - ISO string for end date
 * @returns {Promise<import('../../components/pages/batch-review/types').BatchRecord[]>}
 */
export async function getBatchRecordsWithDateFilter(fromDate, toDate) {
  try {
    const { data: fieldDefs, error: fieldDefError } = await supabase
      .from("field_defs")
      .select("id")
      .eq("key", "manufacturing_date");

    if (fieldDefError) {
      console.error("Error fetching field definitions:", fieldDefError);
      throw fieldDefError;
    }

    if (!fieldDefs || fieldDefs.length === 0) {
      return [];
    }

    const fieldDefIds = fieldDefs.map((fd) => fd.id);

    const { data: fieldValues, error: fieldValuesError } = await supabase
      .from("bmr_field_values")
      .select("bmr_id, value")
      .in("field_def_id", fieldDefIds);

    if (fieldValuesError) {
      console.error("Error fetching field values:", fieldValuesError);
      throw fieldValuesError;
    }

    if (!fieldValues || fieldValues.length === 0) {
      return [];
    }

    const parseDateValue = (dateStr) => {
      if (!dateStr) return null;
      const parsed = new Date(dateStr);
      return isNaN(parsed.getTime()) ? null : parsed;
    };

    const fromDateTime = fromDate ? new Date(fromDate) : null;
    const toDateTime = toDate ? new Date(toDate) : null;

    const filteredBmrIds = fieldValues
      .filter((fv) => {
        const mfgDate = parseDateValue(fv.value);
        if (!mfgDate) return false;

        if (fromDateTime && mfgDate < fromDateTime) return false;
        if (toDateTime && mfgDate > toDateTime) return false;

        return true;
      })
      .map((fv) => fv.bmr_id);

    const bmrIds = [...new Set(filteredBmrIds)];

    if (bmrIds.length === 0) {
      return [];
    }

    const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
    const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error("Missing Supabase environment variables");
    }

    const url = new URL(`${supabaseUrl}/rest/v1/bmrs`);
    url.searchParams.append(
      "select",
      "*,cdmos(id,name),drugs(id,name),batch_record_deviations(count),mbrs!inner(mbr_spec_draft_fields(expected_value,label))"
    );

    url.searchParams.append(
      "mbrs.mbr_spec_draft_fields.or",
      "(label.ilike.Batch Number,label.ilike.Batch Id,label.ilike.Batch No)"
    );

    url.searchParams.append("id", `in.(${bmrIds.join(",")})`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching filtered batch records:", errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Error fetching filtered batch records:", error);
    throw error;
  }
}

/**
 * Update a batch record
 * @param {string} batchId
 * @param {Partial<import('../../components/pages/batch-review/types').BatchRecord>} updates
 */
export async function updateBatchRecord(batchId, updates) {
  const { data, error } = await supabase
    .from("bmrs")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
      was_edited: true,
    })
    .eq("id", batchId)
    .select(
      `
      *,
      vendors (id, name),
      products (id, name)
    `
    )
    .single();

  if (error) {
    console.error("Error updating batch record:", error);
    throw error;
  }

  return data;
}

/**
 * Validate a batch record
 * @param {string} batchId
 * @param {string} userId - Optional ID of user validating
 */
export async function validateBatchRecord(batchId, userId) {
  const { data, error } = await supabase
    .from("batch_records")
    .update({
      validation_status: "Validated",
      validated_at: new Date().toISOString(),
      validated_by: userId || "Current User", // Replace with actual user name/ID when auth is integrated
    })
    .eq("id", batchId)
    .select(
      `
      *,
      vendors (id, name),
      products (id, name)
    `
    )
    .single();

  if (error) {
    console.error("Error validating batch record:", error);
    throw error;
  }

  return data;
}

/**
 * Fetch all batch records with batch label from mbr_spec_draft_fields using REST API
 * This function uses the Supabase REST API directly to filter nested relations
 * @returns {Promise<import('../../components/pages/batch-review/types').BatchRecord[]>}
 */
export async function getBatchRecordsWithBatchLabel() {
  const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
  const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  // Construct the REST API URL with query parameters
  // Using PostgREST syntax to filter nested resources
  const url = new URL(`${supabaseUrl}/rest/v1/bmrs`);
  url.searchParams.append(
    "select",
    "*,cdmos(id,name),drugs(id,name),batch_record_deviations(count),mbrs!inner(mbr_spec_draft_fields(expected_value,label))"
  );

  // Filter mbr_spec_draft_fields by label (case-insensitive)
  // Using 'or' logic on the nested resource
  url.searchParams.append(
    "mbrs.mbr_spec_draft_fields.or",
    "(label.ilike.Batch Number,label.ilike.Batch Id,label.ilike.Batch No)"
  );

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error fetching batch records:", errorText);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data || [];
  } catch (error) {
    console.error("Error fetching batch records with batch label:", error);
    throw error;
  }
}
