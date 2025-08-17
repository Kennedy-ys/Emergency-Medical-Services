import { db } from "../firebaseConfig";
import { ref, push, set } from "firebase/database";
import { getQueuedPatients, clearQueuedPatients } from "./patientQueue";

export async function syncQueuedPatients() {
  const queued = await getQueuedPatients();

  if (!queued.length) return;

  for (const patient of queued) {
    try {
      const patientRef = push(ref(db, "patients"));
      await set(patientRef, patient);
    } catch (error) {
      console.error("❌ Failed to sync patient:", patient, error);
      return; // Stop sync if there's an error
    }
  }

  console.log("✅ Synced all offline patients.");
  await clearQueuedPatients();
}
