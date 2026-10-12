import { Icon } from "../../components/shared";

export function MetricCard({ label, value, detail, icon }: { label: string; value: unknown; detail: string; icon: string }) {  
  return <div className="metric card"><div className="metric-top"><span>{label}</span><span className="metric-icon"><Icon name={icon} size={17}/></span></div><strong>{typeof value === "number" ? value.toLocaleString() : "â€”"}</strong><small>{detail}</small></div>;
}
