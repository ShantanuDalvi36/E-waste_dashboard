import { Router, type IRouter } from "express";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

type EWasteRecord = Record<string, string | number>;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    const nextCharacter = line[index + 1];

    if (character === '"' && quoted && nextCharacter === '"') {
      value += '"';
      index += 1;
    } else if (character === '"') {
      quoted = !quoted;
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value);
  return values;
}

function parseCsv(content: string): EWasteRecord[] {
  const lines = content.split(/\r?\n/).filter(Boolean);
  const headers = parseCsvLine(lines[0] ?? "");
  const numericFields = new Set([
    "year",
    "month",
    "e_waste_collected_kg",
    "formal_collected_kg",
    "informal_collected_kg",
    "material_recovered_kg",
    "disposed_kg",
    "hazardous_kg",
    "estimated_jobs_supported",
    "estimated_revenue_inr",
    "recovery_rate_pct",
    "compliance_score_pct",
    "worker_safety_score_pct",
    "formal_share_pct",
    "informal_share_pct",
    "recovery_value_inr_per_kg",
  ]);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return headers.reduce<EWasteRecord>((record, header, index) => {
      const rawValue = values[index] ?? "";
      record[header] = numericFields.has(header) ? Number(rawValue) : rawValue;
      return record;
    }, {});
  });
}

const router: IRouter = Router();
const dataPath = resolve(
  process.cwd(),
  "data/e_waste_formal_informal_india_dashboard.csv",
);

router.get("/e-waste/data", (_req, res) => {
  const records = parseCsv(readFileSync(dataPath, "utf8"));
  res.json(records);
});

export default router;