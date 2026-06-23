import { useEffect } from "react";

const BreakReminder = () => {
  useEffect(() => {
  console.log("BreakReminder Started");
    // Ask permission once
    if ("Notification" in window && Notification.permission !== "granted") {
      Notification.requestPermission();
    }

  const notify = () => {
  console.log("Timer Triggered");

  // Play sound
  const audio = new Audio("/notification.mp3");
  audio.play();

  if (Notification.permission === "granted") {
    new Notification("Halo Effect Reminder", {
      body: "Take 2 minutes rest 😊",
      icon: "/Logowhite.png",
    });
  }
};
    // FOR TESTING -> 10 sec
    const interval = setInterval(notify, 10 * 1000);

    // REAL TIME -> 45 mins
    // const interval = setInterval(notify, 45 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return null;
};

export default BreakReminder;