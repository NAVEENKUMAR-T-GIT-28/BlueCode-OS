export type NavItem = { path: string; label: string; icon: string };

export const navItems: NavItem[] = [
  { path: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { path: "/icps", label: "Ideal customer profiles", icon: "target" },
  { path: "/prospects", label: "Prospects", icon: "building" },
  { path: "/outreach", label: "Outreach", icon: "send" },
  { path: "/next-actions", label: "Next actions", icon: "check-square" },
  { path: "/activity", label: "Activity", icon: "activity" },
  { path: "/usage", label: "Usage", icon: "chart" },
  { path: "/settings", label: "Workspace settings", icon: "settings" },
];