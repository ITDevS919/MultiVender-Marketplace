import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyDETl5diKbDoNTI_MUZDFgnTPpSkbrSvoM",
  authDomain: "greenbay-chat.firebaseapp.com",
  databaseURL: "https://greenbay-chat.firebaseio.com",
  projectId: "greenbay-chat",
  storageBucket: "greenbay-chat.firebasestorage.app",
  messagingSenderId: "935587814271",
  appId: "1:935587814271:web:c21862c9f0504b9975184a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);

// Initialize anonymous auth with proper waiting
let authInitPromise: Promise<void> | null = null;

export async function initializeFirebaseAuth(): Promise<void> {
  // Return existing promise if initialization is in progress
  if (authInitPromise) {
    return authInitPromise;
  }

  // If already authenticated, return immediately
  if (auth.currentUser) {
    return Promise.resolve();
  }

  // Create initialization promise
  authInitPromise = (async () => {
    try {
      const userCredential = await signInAnonymously(auth);
      console.log("Firebase anonymous auth successful:", userCredential.user.uid);
      return;
    } catch (error: any) {
      console.error("Firebase anonymous auth failed:", error);
      // Reset promise so we can retry
      authInitPromise = null;
      throw error;
    }
  })();

  return authInitPromise;
}

// Auto-initialize on app load
initializeFirebaseAuth().catch((error) => {
  console.error("Auto-initialization failed:", error);
});

export default app;
