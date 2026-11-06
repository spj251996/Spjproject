import type { DesignerCredit } from "./types.ts";
import { validateDesignerCredit } from "./validate.ts";

export const credit: DesignerCredit = validateDesignerCredit({
  lead: "Design",
  name: "Aishwarya Ganesan",
  url: "https://aishwaryaganesan.vercel.app/",
});
