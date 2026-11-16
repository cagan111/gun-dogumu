import { panelMeta } from "../_ui/meta";
import { CustomersView } from "../_ui/customers";

export const generateMetadata = panelMeta("nav.customers");
export default function Page() {
  return <CustomersView />;
}
