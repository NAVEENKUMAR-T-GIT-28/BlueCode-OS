import { Icon } from "../../components/shared";
import type { RecordValue } from "../page-types";

export function DefinitionList({ rows }: { rows: [string, unknown][] }) {
  return <dl className="definition-list">{rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value === null || value === undefined || value === "" ? "â€”" : typeof value === "object" ? JSON.stringify(value) : String(value)}</dd></div>)}</dl>;
}
