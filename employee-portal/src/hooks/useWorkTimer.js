import { useState, useEffect, useRef } from "react";
import {
  collection, addDoc, query,
  where, getDocs, updateDoc,
  doc, orderBy, limit, serverTimestamp
} from "firebase/firestore";
import { db }        from "../firebase/config";
import useAuthStore  from "../store/authStore";

const useWorkTimer = () => {
  const { user }              = useAuthStore();
  const [activeSession,  setActiveSession]  = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [todayMinutes,   setTodayMinutes]   = useState(0);
  const [weekMinutes,    setWeekMinutes]    = useState(0);
  const [loading,        setLoading]        = useState(true);
  const intervalRef = useRef(null);

  // ── Format seconds → HH:MM:SS ──────────────────────────────────
  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // ── Format minutes → "Xh Ym" ───────────────────────────────────
  const formatMinutes = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  // ── Load active session + today/week stats ──────────────────────
  const loadSessionData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today     = new Date().toISOString().split("T")[0];
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      const weekStartStr = weekStart.toISOString().split("T")[0];

      const sessRef = collection(db, "timeLogs", user.uid, "sessions");

      // Active session
      const activeQ  = query(sessRef, where("status", "==", "active"), limit(1));
      const activeSnap = await getDocs(activeQ);
      if (!activeSnap.empty) {
        const sess     = { id: activeSnap.docs[0].id, ...activeSnap.docs[0].data() };
        const started  = sess.startTime.seconds * 1000;
        const elapsed  = Math.floor((Date.now() - started) / 1000);
        setActiveSession(sess);
        setElapsedSeconds(elapsed);
      }

      // Today's total
      const todayQ   = query(sessRef, where("date", "==", today), where("status", "==", "completed"));
      const todaySnap = await getDocs(todayQ);
      const todayMins = todaySnap.docs.reduce((sum, d) => sum + (d.data().duration || 0), 0);
      setTodayMinutes(todayMins);

      // Week's total
      const weekQ    = query(sessRef, where("date", ">=", weekStartStr), where("status", "==", "completed"));
      const weekSnap = await getDocs(weekQ);
      const weekMins = weekSnap.docs.reduce((sum, d) => sum + (d.data().duration || 0), 0);
      setWeekMinutes(weekMins);

    } catch (err) { console.error(err); }
    setLoading(false);
  };

  useEffect(() => { loadSessionData(); }, [user]);

  // ── Live counter ───────────────────────────────────────────────
  useEffect(() => {
    if (activeSession) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [activeSession]);

  // ── Clock In ───────────────────────────────────────────────────
  const clockIn = async () => {
    if (!user || activeSession) return;
    try {
      const today   = new Date().toISOString().split("T")[0];
      const sessRef = collection(db, "timeLogs", user.uid, "sessions");
      const newDoc  = await addDoc(sessRef, {
        startTime: serverTimestamp(),
        endTime:   null,
        duration:  null,
        date:      today,
        status:    "active",
      });
      setActiveSession({ id: newDoc.id, date: today, status: "active", startTime: { seconds: Date.now() / 1000 } });
      setElapsedSeconds(0);
    } catch (err) { console.error(err); }
  };

  // ── Clock Out ──────────────────────────────────────────────────
  const clockOut = async () => {
    if (!user || !activeSession) return;
    try {
      const durationMins = Math.floor(elapsedSeconds / 60);
      const sessDocRef   = doc(db, "timeLogs", user.uid, "sessions", activeSession.id);
      await updateDoc(sessDocRef, {
        endTime:  serverTimestamp(),
        duration: durationMins,
        status:   "completed",
      });
      setTodayMinutes((prev) => prev + durationMins);
      setWeekMinutes((prev)  => prev + durationMins);
      setActiveSession(null);
      setElapsedSeconds(0);
    } catch (err) { console.error(err); }
  };

  return {
    activeSession,
    elapsedSeconds,
    todayMinutes,
    weekMinutes,
    loading,
    clockIn,
    clockOut,
    formatTime,
    formatMinutes,
  };
};

export default useWorkTimer;
