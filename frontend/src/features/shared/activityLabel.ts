export function activityLabel(value?: string) { return (value || "activity").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
