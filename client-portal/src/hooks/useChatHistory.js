import { useEffect, useState } from "react";
import {
  collection, addDoc, query,
  orderBy, onSnapshot, serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";

const useChatHistory = () => {
  const { user } = useAuthStore();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "chatHistory", user.uid, "messages"),
      orderBy("createdAt", "asc")
    );
    const unsub = onSnapshot(q, (snap) => {
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });
    return () => unsub();
  }, [user]);

  const saveMessage = async (role, content) => {
    if (!user) return;
    await addDoc(
      collection(db, "chatHistory", user.uid, "messages"),
      { role, content, createdAt: serverTimestamp() }
    );
  };

  return { messages, loading, saveMessage };
};

export default useChatHistory;
