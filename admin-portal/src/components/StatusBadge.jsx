const styles = {
  "to-do":        "bg-violet-50 text-violet-700 border border-violet-200",
  "in-progress":  "bg-amber-50 text-amber-700 border border-amber-200",
  "completed":    "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "open":         "bg-indigo-50 text-indigo-700 border border-indigo-200",
  "resolved":     "bg-gray-50 text-gray-500 border border-gray-200",
  "pending":      "bg-orange-50 text-orange-600 border border-orange-200",
  "approved":     "bg-emerald-50 text-emerald-700 border border-emerald-200",
  "rejected":     "bg-red-50 text-red-600 border border-red-200",
};

const StatusBadge = ({ status }) => (
  <span className={`text-xs font-semibold px-3 py-1 rounded-full capitalize ${styles[status] || "bg-gray-50 text-gray-500 border border-gray-200"}`}>
    {status || "to-do"}
  </span>
);

export default StatusBadge;
