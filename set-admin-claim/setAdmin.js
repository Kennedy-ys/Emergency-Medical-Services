// setAdmin.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json"); // 👈 Add your service account key

// Initialize the app
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const uid = "eXVnRrVD91Yi8Szznbpb8rsAyU22"; // 👈 Replace with the UID of the user you want to make an admin

admin.auth().setCustomUserClaims(uid, { admin: true })
  .then(() => {
    console.log(`✅ Custom claim set. UID ${uid} is now an admin.`);
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Error setting admin claim:", error);
    process.exit(1);
  });
