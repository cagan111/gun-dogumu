import { panelMeta } from "../_ui/meta";
import { SettingsView } from "../_ui/settings";

export const generateMetadata = panelMeta("nav.settings");
export default function Page() {
  return <SettingsView />;
}
