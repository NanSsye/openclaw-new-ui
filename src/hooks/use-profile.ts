"use client";

import { useEffect, useState } from "react";

export type UserProfile = {
  avatar: string | null;
  nickname: string;
  bio: string;
};

const PROFILE_STORAGE_KEY = "openclaw.profile.v1";
const PROFILE_UPDATED_EVENT = "profile-updated";
const ADMIN_NICKNAME = "NanSsye";
const LEGACY_ADMIN_NICKNAME = "管理员";

export const DEFAULT_PROFILE: UserProfile = {
  avatar: null,
  nickname: ADMIN_NICKNAME,
  bio: "Admin Session",
};

function mergeProfile(profile: Partial<UserProfile>): UserProfile {
  return { ...DEFAULT_PROFILE, ...profile };
}

export function getStoredProfile(): UserProfile | null {
  if (typeof window === "undefined") return null;

  try {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (!stored) return null;

    const parsed = JSON.parse(stored) as Partial<UserProfile>;
    const migrated =
      parsed.nickname === LEGACY_ADMIN_NICKNAME
        ? { ...parsed, nickname: ADMIN_NICKNAME }
        : parsed;
    const merged = mergeProfile(migrated);
    const normalized = JSON.stringify(merged);

    if (stored !== normalized) {
      localStorage.setItem(PROFILE_STORAGE_KEY, normalized);
    }

    return merged;
  } catch {
    return null;
  }
}

function readProfile(): UserProfile {
  return getStoredProfile() ?? DEFAULT_PROFILE;
}

export function saveStoredProfile(newProfile: Partial<UserProfile>): UserProfile {
  const merged = mergeProfile({ ...readProfile(), ...newProfile });

  if (typeof window !== "undefined") {
    localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(new Event(PROFILE_UPDATED_EVENT));
  }

  return merged;
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);

  useEffect(() => {
    const loadProfile = () => {
      setProfile(readProfile());
    };

    loadProfile();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === PROFILE_STORAGE_KEY) loadProfile();
    };

    window.addEventListener(PROFILE_UPDATED_EVENT, loadProfile);
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener(PROFILE_UPDATED_EVENT, loadProfile);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);

  const saveProfile = (newProfile: Partial<UserProfile>) => {
    const merged = saveStoredProfile(newProfile);
    setProfile(merged);
  };

  return { profile, saveProfile };
}
