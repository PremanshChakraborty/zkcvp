import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
  INVITE_STATUSES,
  REQUIREMENT_STATUSES,
  ROLES,
  VERDICTS,
} from "../src/domain";

/**
 * The design system and this package describe the same domain from two sides.
 * TypeScript cannot see across them — design-system-ledger deliberately imports
 * nothing, so its types.ts can stay byte-identical to the first visual
 * direction's copy. That leaves textual comparison as the only available check,
 * and drift here means one surface tells a user something another does not.
 *
 * There are TWO design-system copies in this repo: `design-system-ledger`
 * (the current visual direction) and `design-system` (the earlier one). Both
 * are supposed to carry the same domain enum unions as this package, so both
 * are checked here.
 *
 * If this fails: fix packages/contracts. NEVER edit either types.ts file to
 * make this pass — design-system-ledger/components/types.ts is byte-identical
 * to design-system/components/types.ts on purpose; a failure here means one
 * of the two design-system copies has actually drifted, which is a real
 * finding to report, not something to paper over.
 */
const TYPES_PATHS = {
  "design-system-ledger": fileURLToPath(
    new URL("../../design-system-ledger/components/types.ts", import.meta.url),
  ),
  "design-system": fileURLToPath(
    new URL("../../../design-system/components/types.ts", import.meta.url),
  ),
};

async function unionMembers(
  alias: string,
  typesPath: string,
): Promise<string[]> {
  const src = await readFile(typesPath, "utf8");
  const m = new RegExp(`export type ${alias} =([^;]+);`).exec(src);
  if (!m) throw new Error(`Type alias ${alias} not found in ${typesPath}`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
}

describe.each(Object.entries(TYPES_PATHS))(
  "contracts/design-system enum parity (%s)",
  (_label, typesPath) => {
    it("RequirementStatus matches", async () => {
      expect(await unionMembers("RequirementStatus", typesPath)).toEqual([
        ...REQUIREMENT_STATUSES,
      ]);
    });

    it("Verdict matches", async () => {
      expect(await unionMembers("Verdict", typesPath)).toEqual([...VERDICTS]);
    });

    it("Role matches", async () => {
      expect(await unionMembers("Role", typesPath)).toEqual([...ROLES]);
    });

    it("InviteStatus matches", async () => {
      expect(await unionMembers("InviteStatus", typesPath)).toEqual([
        ...INVITE_STATUSES,
      ]);
    });
  },
);
