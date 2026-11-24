import { File, Paths } from "expo-file-system";
export function journalExportFile() {
  return new File(Paths.cache, "CryptoSight-journal.csv");
}
export async function clearJournalExport() {
  try {
    const file = journalExportFile();
    if (file.exists) await file.delete();
  } catch {
    // A missing/OS-purged export must not prevent account logout.
  }
}
