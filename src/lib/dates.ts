/** Session dates are stored as UTC midnight, so always format them in UTC. */
export function formatDate(date: Date, style: "medium" | "short" = "medium") {
  return date.toLocaleDateString("en-GB", { timeZone: "UTC", dateStyle: style });
}
