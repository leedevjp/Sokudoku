import shell from "./dashboard-shell.module.css";
import memory from "./dashboard-memory.module.css";
import activity from "./dashboard-activity.module.css";
import stages from "./dashboard-stages.module.css";

// One class map preserves consumers while styles are grouped by responsibility.
const styles = { ...shell, ...memory, ...activity, ...stages };
export default styles;
