import { panelMeta } from "../_ui/meta";
import { StaffView } from "../_ui/staff";

export const generateMetadata = panelMeta("nav.staff");
export default function Page() {
  return <StaffView />;
}
