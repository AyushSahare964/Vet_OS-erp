/**
 * Shared diagnostic test catalog — backed by MongoDB via the generic ErpRow
 * store (moduleId "lab_test_catalog"). Used by both the Test Master &
 * Profiles admin screen and the Create Lab Order modal so both share a
 * single source of truth: tests added/removed in one place show up in the
 * other immediately.
 */
import { getRowsFn, addRowFn, deleteRowFn } from "@/lib/mongodb/serverFns/rows";

export const LAB_TEST_CATALOG_MODULE = "lab_test_catalog";

export interface LabTestProfile {
  code: string;
  name: string;
  sample: string;
  dept: string;
  tat: string;
  price: number;
  urgentAvailable: boolean;
}

export async function loadTestCatalog(): Promise<LabTestProfile[]> {
  const rows = await getRowsFn({ data: { moduleId: LAB_TEST_CATALOG_MODULE } });
  return (rows ?? []) as unknown as LabTestProfile[];
}

export async function addTestToCatalog(test: LabTestProfile) {
  return addRowFn({ data: { moduleId: LAB_TEST_CATALOG_MODULE, row: test } });
}

export async function deleteTestFromCatalog(index: number) {
  return deleteRowFn({ data: { moduleId: LAB_TEST_CATALOG_MODULE, index } });
}
