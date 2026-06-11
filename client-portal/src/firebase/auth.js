import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./config";
import useAuthStore from "../store/authStore";

export const initAuthListener = () => {
  const { setUser, setUserData, setLoading } = useAuthStore.getState();

  onAuthStateChanged(auth, async (user) => {
    if (user) {
      const docRef = doc(db, "users", user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.role !== "client") {
          await auth.signOut();
          setUser(null);
          setUserData(null);
        } else {
          setUser(user);
          setUserData(data);
        }
      }
    } else {
      setUser(null);
      setUserData(null);
    }
    setLoading(false);
  });
};
