import { panelMeta } from "../_ui/meta";
import { ReportsView } from "../_ui/reports";

export const generateMetadata = panelMeta("nav.reports");
export default function Page() {
  return <ReportsView />;
}
