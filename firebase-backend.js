import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, getFirestore, serverTimestamp, setDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const event = detail => window.dispatchEvent(new CustomEvent("progress-cloud", { detail }));
const configured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("REPLACE_ME");

if (!configured) {
  event({ configured: false, ready: true, message: "Cloud saving needs Firebase configuration." });
} else {
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const provider = new GoogleAuthProvider();
  let user = null;
  let writeTimer = null;
  let submitted = false;

  const progressRef = uid => doc(db, "users", uid, "modules", "intro-microbes");
  const submissionRef = uid => doc(db, "submissions", uid);
  const lecturerRef = uid => doc(db, "lecturers", uid);
  const clean = value => JSON.parse(JSON.stringify(value));

  async function saveNow(state) {
    if (!user || submitted) return;
    event({ user, busy: true, message: "Saving…" });
    try {
      await setDoc(progressRef(user.uid), { state: clean(state), updatedAt: serverTimestamp() });
      event({ user, message: "Saved to your account." });
    } catch (error) {
      console.error("Cloud save failed", error);
      event({ user, message: "Cloud save failed. Check your connection and try again." });
    }
  }

  window.progressCloud = {
    save(state) {
      if (!user || submitted) return;
      clearTimeout(writeTimer);
      writeTimer = setTimeout(() => saveNow(state), 700);
    },
    async submit(state, identity, summary) {
      if (!user || submitted) throw new Error("Submission is unavailable");
      clearTimeout(writeTimer);
      event({ user, busy: true, message: "Submitting your assessment…" });
      await setDoc(submissionRef(user.uid), {
        uid: user.uid,
        moduleId: "intro-microbes",
        student: {
          name: String(identity?.name || user.displayName || "").trim(),
          matric: String(identity?.matric || "").trim(),
          email: String(user.email || "")
        },
        summary: clean(summary),
        state: clean(state),
        status: "submitted",
        submittedAt: serverTimestamp()
      });
      submitted = true;
      const record = { status: "submitted", student: { ...identity, email: user.email || "" }, summary, submittedAt: new Date() };
      event({ user, submission: record, message: "Assessment submitted and locked." });
      return record;
    },
    async listSubmissions() {
      const snapshot = await getDocs(collection(db, "submissions"));
      return snapshot.docs.map(item => ({ id: item.id, ...item.data() }));
    },
    async toggleAuth() {
      if (user) { await signOut(auth); return; }
      event({ busy: true, message: "Opening Google sign-in…" });
      try {
        if (matchMedia("(max-width: 700px)").matches) await signInWithRedirect(auth, provider);
        else await signInWithPopup(auth, provider);
      } catch (error) {
        console.error("Google sign-in failed", error);
        event({ busy: false, message: error.code === "auth/popup-closed-by-user" ? "Sign-in was cancelled." : "Could not sign in with Google." });
      }
    }
  };

  onAuthStateChanged(auth, async currentUser => {
    user = currentUser;
    if (!user) { event({ user: null, ready: true, message: "Sign in to begin or continue your lessons." }); return; }
    event({ user, busy: true, message: "Checking saved progress…" });
    try {
      const [snapshot, lecturerSnapshot, submissionSnapshot] = await Promise.all([
        getDoc(progressRef(user.uid)), getDoc(lecturerRef(user.uid)), getDoc(submissionRef(user.uid))
      ]);
      const cloud = snapshot.exists() ? snapshot.data() : null;
      const submission = submissionSnapshot.exists() ? submissionSnapshot.data() : null;
      submitted = Boolean(submission);
      event({ user, ready: true, role: lecturerSnapshot.exists() ? "lecturer" : "student", submission,
        state: cloud?.state || submission?.state || null,
        message: submission ? "Your submitted work is locked." : cloud?.state ? "Progress restored from your account." : "Signed in. Your progress will save automatically." });
    } catch (error) {
      console.error("Cloud load failed", error);
      event({ user: null, ready: true, message: "Could not load your progress. Please try signing in again." });
    }
  });
}
