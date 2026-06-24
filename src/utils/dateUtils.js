import { format } from "date-fns";

/**
 * Formats a date string for display in a user-friendly format
 * @param {string} dateString - The date string to format
 * @returns {string} - Formatted date string like "May 24, 2024 at 9:29 PM" or error message
 */
export const formatDate = (dateString) => {
  if (!dateString) return "N/A";

  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Invalid date";

  // Format: "May 24, 2024 at 9:29 PM"
  return (
    date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }) +
    " at " +
    date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  );
};

/**
 * Formats a date string for HTML5 date input (YYYY-MM-DD)
 * @param {string} dateString - The date string to format
 * @returns {string} - Formatted date string or empty string
 */
export const formatDateForInput = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "";
  return date.toISOString().split("T")[0];
};

/**
 * Formats a date string for saving (d MMMM yyyy)
 * @param {string} dateString - The date string to format
 * @returns {string} - Formatted date string
 */
export const formatDateForSave = (dateString) => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;
  return format(date, "d MMMM yyyy");
};

// /**
//  * Formats a date to a relative time string (e.g., "2 hours ago", "Yesterday")
//  * @param {string} dateString - The date string to format
//  * @returns {string} - Relative time string
//  */
// export const formatRelativeTime = (dateString) => {
//   if (!dateString) return 'N/A';

//   const date = new Date(dateString);
//   if (isNaN(date.getTime())) return 'Invalid date';

//   const now = new Date();
//   const diffInSeconds = Math.floor((now - date) / 1000);

//   // Less than a minute
//   if (diffInSeconds < 60) {
//     return 'Just now';
//   }

//   // Less than an hour
//   if (diffInSeconds < 3600) {
//     const minutes = Math.floor(diffInSeconds / 60);
//     return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
//   }

//   // Less than a day
//   if (diffInSeconds < 86400) {
//     const hours = Math.floor(diffInSeconds / 3600);
//     return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
//   }

//   // Less than a week
//   if (diffInSeconds < 604800) {
//     const days = Math.floor(diffInSeconds / 86400);
//     if (days === 1) return 'Yesterday';
//     return `${days} days ago`;
//   }

//   // Less than a month
//   if (diffInSeconds < 2592000) {
//     const weeks = Math.floor(diffInSeconds / 604800);
//     return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
//   }

//   // Fall back to absolute date for older dates
//   return formatDate(dateString);
// };

// export default {
//   formatDate,
//   formatRelativeTime
// };
