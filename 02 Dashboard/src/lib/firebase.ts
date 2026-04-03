import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'

const firebaseConfig = {
  apiKey: 'AIzaSyCFDAmrJ9d8d1nOKe143czhXiOlgzYRHUQ',
  authDomain: 'cyphev.firebaseapp.com',
  projectId: 'cyphev',
  storageBucket: 'cyphev.firebasestorage.app',
  messagingSenderId: '595796184002',
  appId: '1:595796184002:web:ceb479d57ea36725b6e45b',
  measurementId: 'G-QET7CV0SSH',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
