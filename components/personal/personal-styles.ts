import shell from "./personal-shell.module.css";
import editor from "./personal-editor.module.css";
import list from "./personal-list.module.css";

// One class map preserves consumers while styles are grouped by responsibility.
const styles = { ...shell, ...editor, ...list };
export default styles;
