"use client";

import { useCallback, useEffect, useState } from "react";
import { FIT_PROFILE_STORAGE_KEY, parseFitProfile, type FitProfile } from "@/lib/sizeCharts";

const CHANGE_EVENT = "cv:fit-profile-change";

/** Customer's height/weight/fit, kept in localStorage so every product page can use it. */
export function useFitProfile() {
  const [profile, setProfileState] = useState<FitProfile | null>(null);

  useEffect(() => {
    const read = () => setProfileState(parseFitProfile(window.localStorage.getItem(FIT_PROFILE_STORAGE_KEY)));
    read();
    const onStorage = (event: StorageEvent) => {
      if (event.key === FIT_PROFILE_STORAGE_KEY) read();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHANGE_EVENT, read);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHANGE_EVENT, read);
    };
  }, []);

  const setProfile = useCallback((next: FitProfile | null) => {
    setProfileState(next);
    try {
      if (next) window.localStorage.setItem(FIT_PROFILE_STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(FIT_PROFILE_STORAGE_KEY);
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // Private mode: the recommendation still works for this visit.
    }
  }, []);

  return { profile, setProfile };
}
