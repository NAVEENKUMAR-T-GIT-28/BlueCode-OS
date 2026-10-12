import { Button, PageHeader } from "../../components/shared";
import type { PageContext } from "../page-types";
import { DashboardPage } from "../dashboard/DashboardPage";
import { IcpPage } from "../icps/IcpPage";
import { ProspectsPage } from "../prospects/ProspectsPage";
import { OutreachPage } from "../outreach/OutreachPage";
import { NextActionsPage } from "../next-actions/NextActionsPage";
import { ActivityPage } from "../activity/ActivityPage";
import { UsagePage } from "../usage/UsagePage";
import { SettingsPage } from "../settings/SettingsPage";

export function renderRoute(context: PageContext) {
  const { path } = context;
  if (path === "/" || path === "/dashboard") return <DashboardPage {...context}/>;
  if (path === "/icps" || path === "/icps/new" || /^\/icps\/[^/]+$/.test(path)) return <IcpPage key={path} {...context}/>;
  if (path === "/prospects" || path === "/prospects/discover" || /^\/prospects\/[^/]+$/.test(path)) return <ProspectsPage {...context}/>;
  if (path === "/outreach" || /^\/outreach\/[^/]+$/.test(path) || path === "/outreach/messages" || /^\/outreach\/messages\/[^/]+$/.test(path)) return <OutreachPage {...context}/>;
  if (path === "/next-actions") return <NextActionsPage {...context}/>;
  if (path === "/activity") return <ActivityPage {...context}/>;
  if (path === "/usage") return <UsagePage {...context}/>;
  if (path === "/settings") return <SettingsPage {...context}/>;
  return <div className="page-stack"><PageHeader title="Page not found" description="This route is not part of the BlueCode OS MVP preview."/><section className="card panel"><Button onClick={() => context.navigate("/dashboard")}>Back to dashboard</Button></section></div>;
}
