import { useState, useEffect, useRef } from "react";
import {
  collection, doc, addDoc, updateDoc,
  query, getDocs, orderBy, limit,
  serverTimestamp, where
} from "firebase/firestore";
import { db } from "../firebase/config";
import useAuthStore from "../store/authStore";

const toMs = (val) => {
  if (!val) return null;
  if (typeof val === "number") return val;
  if (val?.seconds) return val.seconds * 1000;
  return null;
};

const useWorkTimer = () => {
  const { user } = useAuthStore();

  const [activeSession, setActiveSession] = useState(null);
  const [activeBreak, setActiveBreak] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [breakSeconds, setBreakSeconds] = useState(0);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [weekMinutes, setWeekMinutes] = useState(0);
  const [loading, setLoading] = useState(true);

  const intervalRef = useRef(null);

  const stopTicker = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const computeLiveTimes = (session, liveBreak = null) => {
    if (!session?.startTime) return { workSecs: 0, breakSecs: 0 };

    const now = Date.now();
    const startMs = toMs(session.startTime);
    const totalBreakBefore = Number(session.totalBreakSeconds || 0);
    if (!startMs) return { workSecs: 0, breakSecs: 0 };

    let currentBreakSecs = 0;
    if (liveBreak?.startTime) {
      const breakStartMs = toMs(liveBreak.startTime);
      if (breakStartMs) {
        currentBreakSecs = Math.max(0, Math.floor((now - breakStartMs) / 1000));
      }
    }

    const totalSessionSecs = Math.max(0, Math.floor((now - startMs) / 1000));
    const workSecs = Math.max(0, totalSessionSecs - totalBreakBefore - currentBreakSecs);

    return { workSecs, breakSecs: currentBreakSecs };
  };

  const startTicker = (session, liveBreak = null) => {
    stopTicker();

    const update = () => {
      const { workSecs, breakSecs } = computeLiveTimes(session, liveBreak || activeBreak);
      setElapsedSeconds(workSecs);
      setBreakSeconds(breakSecs);
    };

    update();
    intervalRef.current = setInterval(update, 1000);
  };

  const loadTotals = async (sessionsRef) => {
    try {
      const now = new Date();

      const todayStart = new Date(now);
      todayStart.setHours(0, 0, 0, 0);

      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const snap = await getDocs(query(sessionsRef, orderBy("startTime", "desc")));
      let todayMins = 0;
      let weekMins = 0;

      snap.docs.forEach((d) => {
        const s = d.data();
        const startMs = toMs(s.startTime);
        const endMs = toMs(s.endTime);
        if (!startMs || !endMs) return;

        const totalBreakSecs = Number(s.totalBreakSeconds || 0);
        const durMins = (endMs - startMs - totalBreakSecs * 1000) / 60000;

        if (durMins <= 0 || durMins > 1440) return;

        if (startMs >= todayStart.getTime()) todayMins += durMins;
        if (startMs >= weekStart.getTime()) weekMins += durMins;
      });

      setTodayMinutes(Math.round(todayMins));
      setWeekMinutes(Math.round(weekMins));
    } catch (err) {
      console.error("loadTotals error:", err);
    }
  };

  useEffect(() => {
    if (!user?.uid) return;

    const load = async () => {
      setLoading(true);
      try {
        const sessionsRef = collection(db, "timeLogs", user.uid, "sessions");

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStartMs = today.getTime();

        const openSnap = await getDocs(
          query(
            sessionsRef,
            where("endTime", "==", null),
            orderBy("startTime", "desc")
          )
        );

        let foundSession = null;
        let foundBreak = null;

        const openSessions = openSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        foundSession =
          openSessions.find((s) => {
            const startMs = toMs(s.startTime);
            return startMs && startMs >= todayStartMs;
          }) || null;

        if (foundSession) {
          const breaksRef = collection(
            db,
            "timeLogs",
            user.uid,
            "sessions",
            foundSession.id,
            "breaks"
          );

          const bSnap = await getDocs(
            query(breaksRef, orderBy("startTime", "desc"), limit(1))
          );

          if (!bSnap.empty) {
            const bData = { id: bSnap.docs[0].id, ...bSnap.docs[0].data() };
            if (!bData.endTime) foundBreak = bData;
          }
        }

        setActiveSession(foundSession);
        setActiveBreak(foundBreak);

        if (foundSession) {
          const { workSecs, breakSecs } = computeLiveTimes(foundSession, foundBreak);
          setElapsedSeconds(workSecs);
          setBreakSeconds(breakSecs);
          startTicker(foundSession, foundBreak);
        } else {
          stopTicker();
          setElapsedSeconds(0);
          setBreakSeconds(0);
        }

        await loadTotals(sessionsRef);
      } catch (err) {
        console.error("useWorkTimer load error:", err);
      } finally {
        setLoading(false);
      }
    };

    load();
    return () => stopTicker();
  }, [user?.uid]);

  const clockIn = async () => {
    if (!user?.uid || activeSession) return;

    try {
      const now = Date.now();
      const sessionsRef = collection(db, "timeLogs", user.uid, "sessions");

      const docRef = await addDoc(sessionsRef, {
        startTime: now,
        endTime: null,
        breakStartTime: null,
        totalBreakSeconds: 0,
        createdAt: serverTimestamp(),
      });

      const newSession = {
        id: docRef.id,
        startTime: now,
        endTime: null,
        breakStartTime: null,
        totalBreakSeconds: 0,
      };

      setActiveSession(newSession);
      setActiveBreak(null);
      setElapsedSeconds(0);
      setBreakSeconds(0);
      startTicker(newSession, null);
    } catch (err) {
      console.error("clockIn error:", err);
    }
  };

  const startBreak = async () => {
    if (!user?.uid || !activeSession || activeBreak) return;

    try {
      const now = Date.now();

      const breaksRef = collection(
        db, "timeLogs", user.uid, "sessions", activeSession.id, "breaks"
      );

      const docRef = await addDoc(breaksRef, {
        startTime: now,
        endTime: null,
        createdAt: serverTimestamp(),
      });

      const breakObj = { id: docRef.id, startTime: now, endTime: null };

      await updateDoc(
        doc(db, "timeLogs", user.uid, "sessions", activeSession.id),
        { breakStartTime: now }
      );

      setActiveBreak(breakObj);
      startTicker(activeSession, breakObj);
    } catch (err) {
      console.error("startBreak error:", err);
    }
  };

  const endBreak = async (silent = false) => {
    if (!user?.uid || !activeSession || !activeBreak) return 0;

    try {
      const now = Date.now();
      const breakStartMs = toMs(activeBreak.startTime);
      const breakDurationSecs = breakStartMs
        ? Math.max(0, Math.floor((now - breakStartMs) / 1000))
        : 0;

      const breakRef = doc(
        db,
        "timeLogs",
        user.uid,
        "sessions",
        activeSession.id,
        "breaks",
        activeBreak.id
      );

      const sessionRef = doc(db, "timeLogs", user.uid, "sessions", activeSession.id);

      const updatedSession = {
        ...activeSession,
        breakStartTime: null,
        totalBreakSeconds: Number(activeSession.totalBreakSeconds || 0) + breakDurationSecs,
      };

      await updateDoc(breakRef, { endTime: now });
      await updateDoc(sessionRef, {
        breakStartTime: null,
        totalBreakSeconds: updatedSession.totalBreakSeconds,
      });

      if (!silent) {
        setActiveSession(updatedSession);
        setActiveBreak(null);
        setBreakSeconds(0);
        startTicker(updatedSession, null);
      }

      return breakDurationSecs;
    } catch (err) {
      console.error("endBreak error:", err);
      return 0;
    }
  };

  const clockOut = async () => {
    if (!user?.uid || !activeSession) return;

    try {
      let updatedSession = activeSession;

      if (activeBreak) {
        const breakSecs = await endBreak(true);
        updatedSession = {
          ...activeSession,
          breakStartTime: null,
          totalBreakSeconds: Number(activeSession.totalBreakSeconds || 0) + breakSecs,
        };
      }

      const now = Date.now();
      const sessionRef = doc(db, "timeLogs", user.uid, "sessions", updatedSession.id);

      await updateDoc(sessionRef, {
        endTime: now,
        breakStartTime: null,
        totalBreakSeconds: Number(updatedSession.totalBreakSeconds || 0),
      });

      const startMs = toMs(updatedSession.startTime);
      const finalWorkedSecs = startMs
        ? Math.max(
            0,
            Math.floor((now - startMs) / 1000) - Number(updatedSession.totalBreakSeconds || 0)
          )
        : 0;

      const durMins = Math.round(finalWorkedSecs / 60);

      setTodayMinutes((p) => p + durMins);
      setWeekMinutes((p) => p + durMins);

      setActiveSession(null);
      setActiveBreak(null);
      setElapsedSeconds(0);
      setBreakSeconds(0);
      stopTicker();
    } catch (err) {
      console.error("clockOut error:", err);
    }
  };

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
    activeBreak,
    elapsedSeconds,
    breakSeconds,
    todayMinutes,
    weekMinutes,
    loading,
    clockIn,
    clockOut,
    startBreak,
    endBreak,
    formatTime,
    formatMinutes,
  };
};

export default useWorkTimer;