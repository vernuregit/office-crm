import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc }        from "firebase/firestore";
import { auth, db }           from "./config";
import useAuthStore           from "../store/authStore";

export const initAuthListener = () => {
  const { setUser, setUserData, setLoading } = useAuthStore.getState();

  onAuthStateChanged(auth, async (firebaseUser) => {
    if (firebaseUser) {
      try {
        // ✅ Admins are stored in "admins" collection
        const docRef  = doc(db, "admins", firebaseUser.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          if (data.role !== "admin") {
            await auth.signOut();
            setUser(null);
            setUserData(null);
          } else {
            setUser(firebaseUser);
            setUserData(data);
          }
        } else {
          await auth.signOut();
          setUser(null);
          setUserData(null);
        }
      } catch (err) {
        console.error("Auth error:", err.message);
        setUser(null);
        setUserData(null);
      }
    } else {
      setUser(null);
      setUserData(null);
    }
    setLoading(false);
  });
};