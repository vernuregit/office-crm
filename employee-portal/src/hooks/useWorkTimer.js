// useWorkTimer.js
import { useState, useEffect, useRef } from "react";
import {
  collection, doc, addDoc, updateDoc,
  query, where, getDocs, orderBy, limit,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";

const useWorkTimer = () => {
  const { user } = useAuthStore();
  const [activeSession,  setActiveSession]  = useState(null);
  const [activeBreak,    setActiveBreak]    = useState(null); // ← new
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [breakSeconds,   setBreakSeconds]   = useState(0);   // ← new
  const [todayMinutes,   setTodayMinutes]   = useState(0);
  const [weekMinutes,    setWeekMinutes]     = useState(0);
  const [loading,        setLoading]        = useState(true);
  const intervalRef      = useRef(null);
  const breakIntervalRef = useRef(null);  // ← new

  // ── Load active session on mount ─────────────────────────────
  useEffect(() => {
    if (!user?.uid) return;
    const load = async () => {
      setLoading(true);
      try {
        const sessionsRef = collection(db, "timeLogs", user.uid, "sessions");

        // Find today's open session
        const q = query(sessionsRef, orderBy("startTime", "desc"), limit(5));
        const snap = await getDocs(q);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let foundSession = null;
        let foundBreak   = null;

        snap.docs.forEach((d) => {
          const data = { id: d.id, ...d.data() };
          const startMs = data.startTime?.seconds
            ? data.startTime.seconds * 1000
            : data.startTime;
          if (!data.endTime && startMs >= today.getTime() && !foundSession) {
            foundSession = data;
          }
        });

        if (foundSession) {
          setActiveSession(foundSession);
          const startMs = foundSession.startTime?.seconds
            ? foundSession.startTime.seconds * 1000
            : foundSession.startTime;
          const elapsed = Math.floor((Date.now() - startMs) / 1000);
          setElapsedSeconds(Math.max(0, elapsed));

          // Check for active break inside this session
          const breaksRef = collection(
            db, "timeLogs", user.uid, "sessions", foundSession.id, "breaks"
          );
          const bSnap = await getDocs(
            query(breaksRef, orderBy("startTime", "desc"), limit(1))
          );
          if (!bSnap.empty) {
            const bData = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() };
            if (!bData.endTime) {
              foundBreak = bData;
              setActiveBreak(bData);
              const bStartMs = bData.startTime?.seconds
                ? bData.startTime.seconds * 1000
                : bData.startTime;
              setBreakSeconds(Math.floor((Date.now() - bStartMs) / 1000));
            }
          }
        }

        // Today + week totals
        await loadTotals(sessionsRef);
      } catch (err) {
        console.error("useWorkTimer load error:", err);
      }
      setLoading(false);
    };
    load();
  }, [user?.uid]);

  // ── Work timer tick ──────────────────────────────────────────
  useEffect(() => {
    if (activeSession) {
      intervalRef.current = setInterval(() => {
        setElapsedSeconds((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [activeSession]);

  // ── Break timer tick ─────────────────────────────────────────
  useEffect(() => {
    if (activeBreak) {
      breakIntervalRef.current = setInterval(() => {
        setBreakSeconds((s) => s + 1);
      }, 1000);
    } else {
      clearInterval(breakIntervalRef.current);
      setBreakSeconds(0);
    }
    return () => clearInterval(breakIntervalRef.current);
  }, [activeBreak]);

  // ── Load totals ───────────────────────────────────────────────
  const loadTotals = async (sessionsRef) => {
    try {
      const now   = new Date();
      const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
      const weekStart  = new Date(now); weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const snap = await getDocs(query(sessionsRef, orderBy("startTime", "desc")));
      let todayMins = 0, weekMins = 0;

      snap.docs.forEach((d) => {
        const s = d.data();
        const startMs = s.startTime?.seconds ? s.startTime.seconds * 1000 : s.startTime;
        const endMs   = s.endTime?.seconds   ? s.endTime.seconds   * 1000 : s.endTime;
        if (!startMs || !endMs) return;

        const durMins = (endMs - startMs) / 60000;
        if (durMins <= 0 || durMins > 1440) return;

        if (startMs >= todayStart.getTime()) todayMins += durMins;
        if (startMs >= weekStart.getTime())  weekMins  += durMins;
      });

      setTodayMinutes(Math.round(todayMins));
      setWeekMinutes(Math.round(weekMins));
    } catch (err) {
      console.error("loadTotals error:", err);
    }
  };

  // ── Clock In ──────────────────────────────────────────────────
  const clockIn = async () => {
    if (!user?.uid || activeSession) return;
    try {
      const now = Date.now();
      const sessionsRef = collection(db, "timeLogs", user.uid, "sessions");
      const docRef = await addDoc(sessionsRef, {
        startTime: now,
        endTime:   null,
        breaks:    [],
        createdAt: serverTimestamp(),
      });
      const newSession = { id: docRef.id, startTime: now, endTime: null };
      setActiveSession(newSession);
      setElapsedSeconds(0);
    } catch (err) {
      console.error("clockIn error:", err);
    }
  };

  // ── Clock Out ─────────────────────────────────────────────────
  const clockOut = async () => {
    if (!user?.uid || !activeSession) return;
    try {
      // End any active break first
      if (activeBreak) await endBreak(true);

      const now = Date.now();
      const sessionRef = doc(db, "timeLogs", user.uid, "sessions", activeSession.id);
      await updateDoc(sessionRef, { endTime: now });

      const durMins = Math.round(elapsedSeconds / 60);
      setTodayMinutes((p) => p + durMins);
      setWeekMinutes((p)  => p + durMins);
      setActiveSession(null);
      setElapsedSeconds(0);
    } catch (err) {
      console.error("clockOut error:", err);
    }
  };

  // ── Start Break ───────────────────────────────────────────────
  const startBreak = async () => {
    if (!user?.uid || !activeSession || activeBreak) return;
    try {
      const now = Date.now();
      const breaksRef = collection(
        db, "timeLogs", user.uid, "sessions", activeSession.id, "breaks"
      );
      const docRef = await addDoc(breaksRef, {
        startTime: now,
        endTime:   null,
        createdAt: serverTimestamp(),
      });
      setActiveBreak({ id: docRef.id, startTime: now, endTime: null });
    } catch (err) {
      console.error("startBreak error:", err);
    }
  };

  // ── End Break ─────────────────────────────────────────────────
  const endBreak = async (silent = false) => {
    if (!user?.uid || !activeSession || !activeBreak) return;
    try {
      const now = Date.now();
      const breakRef = doc(
        db, "timeLogs", user.uid, "sessions", activeSession.id, "breaks", activeBreak.id
      );
      await updateDoc(breakRef, { endTime: now });
      if (!silent) setActiveBreak(null);
    } catch (err) {
      console.error("endBreak error:", err);
    }
    if (!silent) setActiveBreak(null);
  };

  // ── Helpers ───────────────────────────────────────────────────
  const formatTime = (secs) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const formatMinutes = (mins) => {
    if (!mins || mins <= 0) return "0h 0m";
    return `${Math.floor(mins / 60)}h ${Math.round(mins % 60)}m`;
  };

  return {
    activeSession,
    activeBreak,       // ← new
    elapsedSeconds,
    breakSeconds,      // ← new
    todayMinutes,
    weekMinutes,
    loading,
    clockIn,
    clockOut,
    startBreak,        // ← new
    endBreak,          // ← new
    formatTime,
    formatMinutes,
  };
};

export default useWorkTimer;