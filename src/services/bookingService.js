// import { db } from "../firebase/firebaseConfig"; 
// import { ref, push, serverTimestamp } from "firebase/database";

// export const createAmbulanceBooking = async (formData) => {
//   const bookingRef = ref(db, "ambulanceBookings");
//   const newBooking = {
//     ...formData,
//     status: "pending", // pending | assigned | enroute | completed
//     timestamp: serverTimestamp(),
//   };

//   const snapshot = await push(bookingRef, newBooking);
//   return snapshot.key; // return the unique booking ID
// };
