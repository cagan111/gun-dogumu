import { panelMeta } from "../_ui/meta";
import { ServicesView } from "../_ui/services";

export const generateMetadata = panelMeta("nav.services");
export default function Page() {
  return <ServicesView />;
}
