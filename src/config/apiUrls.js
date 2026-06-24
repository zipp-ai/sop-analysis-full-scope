// API URL configuration
const BASE_URL = process.env.REACT_APP_API_URL;
const BATCH_REVIEW_URL = `${BASE_URL}/batch-review`;

const API_URLS = {
  // User endpoints
  USER: {
    PROFILE: `${BASE_URL}/user/profile`,
    PROFILE_COMPLETE: `${BASE_URL}/user/profile/complete`,
    UPDATE_PROFILE: `${BASE_URL}/user/update`,
    RECORD_LOGIN: `${BASE_URL}/user/record-login`,
    UPDATE_USER: (userId) => `${BASE_URL}/user/users/${userId}`,
    RECENT_ACTIVITY: `${BASE_URL}/user/recent-activity`,
    SOPS_COUNT: `${BASE_URL}/user/sops-count`,
    REGULATIONS_COUNT: `${BASE_URL}/user/regulations-count`,
    GAP_COUNT: `${BASE_URL}/user/gap-count`,
    CHECK_USER_EXISTS: (email) => `${BASE_URL}/user/check-status/${email}`,
  },
  // Organization endpoints
  ORGANIZATION: {
    DETAILS: `${BASE_URL}/organization/details`,
    METADATA_UPDATE: (orgId) =>
      `${BASE_URL}/user/organizations/${orgId}/metadata`,
  },
  // SOP endpoints
  SOP: {
    LIST: `${BASE_URL}/sops/`,
    UPLOAD: `${BASE_URL}/sops/upload`,
    DELETE: `${BASE_URL}/sops`,
    DOWNLOAD: `${BASE_URL}/sops/download`,
  },
  // Regulations endpoints
  REGULATIONS: {
    LIST: `${BASE_URL}/regulations/`,
    ORGANIZATION: `${BASE_URL}/regulations/organization`,
    UPLOAD: `${BASE_URL}/regulations/upload`,
    DELETE: (id) => `${BASE_URL}/regulations/${id}`,
  },
  // Analysis endpoints
  ANALYSIS: {
    RESULTS: `${BASE_URL}/analysis/results`,
    ANALYZE: `${BASE_URL}/analysis/analyze`,
    COMPREHENSIVE_ANALYZE: (title) =>
      `${BASE_URL}/analysis/comprehensive/analyze?title=${encodeURIComponent(
        title
      )}`,
    COMPREHENSIVE_RESULTS: `${BASE_URL}/analysis/comprehensive/results`,
    COMPREHENSIVE_VERIFY: (analysisId) =>
      `${BASE_URL}/analysis/comprehensive/verify/${analysisId}`,
    COMPREHENSIVE_EDIT: (analysisId) =>
      `${BASE_URL}/analysis/comprehensive/edit/${analysisId}`,
    COMPREHENSIVE_DELETE: (organizationId, analysisId) =>
      `${BASE_URL}/analysis/comprehensive/delete/${organizationId}/${analysisId}`,
  },
  // Other API endpoints can be added here
  SOPS: {
    GET_ALL: "/sops",
    GET: "/sops",
    CREATE: "/sops",
    UPDATE: "/sops",
    DELETE: "/sops",
    DOWNLOAD: "/sops/download",
  },

  ANALYSIS_RESULTS: {
    UPDATE_META: `${BASE_URL}/analysis/results`,
  },

  DEPARTMENTS: {
    LIST: `${BASE_URL}/sops/departments`,
  },
  CHAT: {
    QUERY: `${BASE_URL}/chat/query`,
    END_SESSION: `${BASE_URL}/chat/end_session`,
  },
  CHAT_SESSION: {
    UPLOAD: `${BASE_URL}/chat_session/upload`,
  },
  BATCH_REVIEW: {
    DRUGS: `${BATCH_REVIEW_URL}/drugs`,
    CDMOS: `${BATCH_REVIEW_URL}/cdmos`,
    VENDOR_COMPLIANCE: `${BATCH_REVIEW_URL}/vendor-compliance`,
    PRODUCT_COMPLIANCE: `${BATCH_REVIEW_URL}/product-compliance`,
    MBR: {
      UPLOAD: `${BATCH_REVIEW_URL}/mbr/upload`,
      DRAFT: (mbrId) => `${BATCH_REVIEW_URL}/mbr/${mbrId}/draft`,
      APPROVE: (mbrId) => `${BATCH_REVIEW_URL}/mbr/${mbrId}/approve`,
      GET: (mbrId) => `${BATCH_REVIEW_URL}/mbr/${mbrId}`,
      PDF_URL: (mbrId) => `${BATCH_REVIEW_URL}/mbr/${mbrId}/pdf-url`,
    },
    BMR: {
      UPLOAD_AND_RUN: `${BATCH_REVIEW_URL}/bmr/upload-and-run`,
      UPDATE_VALUE: (bmrId, fieldDefId) =>
        `${BATCH_REVIEW_URL}/bmr/${bmrId}/field/${fieldDefId}`,
      UPDATE_DEVIATION: (bmrId, deviationId) =>
        `${BATCH_REVIEW_URL}/bmr/${bmrId}/deviation/${deviationId}`,
      MARK_REVIEWED: (bmrId) =>
        `${BATCH_REVIEW_URL}/bmr/${bmrId}/mark-reviewed`,
      COMPUTE_DEVIATIONS: (bmrId) =>
        `${BATCH_REVIEW_URL}/bmr/${bmrId}/compute-deviations`,
      OCR_POLYGONS: (bmrId) => `${BATCH_REVIEW_URL}/bmr/${bmrId}/ocr-polygons`,
      COMPLIANCE_SUMMARY: `${BATCH_REVIEW_URL}/bmr/compliance-summary`,
      GET: (bmrId) => `${BATCH_REVIEW_URL}/bmr/${bmrId}`,
      PDF_URL: (bmrId) => `${BATCH_REVIEW_URL}/bmr/${bmrId}/pdf-url`,
      DOWNLOAD: (bmrId) => `${BATCH_REVIEW_URL}/bmr/${bmrId}/download`,
    },
  },
};

export default API_URLS;
