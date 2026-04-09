import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

let storageInstance: FirebaseStorage | null = null;

export const getStorageInstance = () => {
  if (!storageInstance) {
    try {
      // Explicitly passing the storage bucket from config
      storageInstance = getStorage(app, firebaseConfig.storageBucket);
    } catch (error) {
      console.error("Firebase Storage could not be initialized. Make sure it is enabled in your Firebase Console.", error);
      throw error;
    }
  }
  return storageInstance;
};

export default app;
