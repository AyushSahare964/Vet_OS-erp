import { createContext } from "react";

/** True inside a hub tab: the nested module page (which wraps itself in <Shell>) renders without a second frame. */
export const ShellEmbedContext = createContext(false);
