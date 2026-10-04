import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDgUPSS6-4_NJClzmvimRUKtU5Gh8sZMrQ",
    authDomain: "bucketlister-95e97.firebaseapp.com",
    projectId: "bucketlister-95e97",
    storageBucket: "bucketlister-95e97.firebasestorage.app",
    messagingSenderId: "514776859883",
    appId: "1:514776859883:web:98150fe993a566f247aaae"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

import { GoogleAuthProvider } from 'firebase/auth';

export const provider = new GoogleAuthProvider();
