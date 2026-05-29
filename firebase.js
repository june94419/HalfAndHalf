import { initializeApp } from 'firebase/app';
import { getDatabase } from 'firebase/database';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyB_SKVbwJApU9164EvfXR4r2DVNVWxVJqk",
  authDomain: "half-and-half-58c12.firebaseapp.com",
  databaseURL: "https://half-and-half-58c12-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "half-and-half-58c12",
  storageBucket: "half-and-half-58c12.firebasestorage.app",
  messagingSenderId: "579857293853",
  appId: "1:579857293853:web:3f2eeebe8143cf2f63dcf4"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
