"use client";

import { useCallback, useEffect, useState } from "react";

// Device identity lives in localStorage — this is explicitly allowed by the
// design (device id is for sync/audit, never the shared source of truth).
const DEVICE_KEY = "localshare_device_id";
const NAME_KEY = "localshare_device_name";

function makeId(): string {
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return "device_" + Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function makeDefaultName(): string {
  const ua = navigator.userAgent;
  let platform = "Device";
  if (/iPhone|iPad/.test(ua)) platform = "iPhone/iPad";
  else if (/Android/.test(ua)) platform = "Android";
  else if (/Mac/.test(ua)) platform = "Mac";
  else if (/Windows/.test(ua)) platform = "Windows PC";
  else if (/Linux/.test(ua)) platform = "Linux";
  const suffix = Math.floor(Math.random() * 900 + 100);
  return `${platform} ${suffix}`;
}

export function useDevice() {
  type DeviceState = {
    id: string;
    displayName: string;
    registered: boolean;
  };

  const [device, setDevice] = useState<DeviceState>(() => {
    if (typeof window === "undefined") {
      return { id: "device_x", displayName: "Device", registered: false };
    }
    const stored = window.localStorage.getItem(DEVICE_KEY);
    const id = stored && /^device_[a-f0-9]+$/.test(stored) ? stored : makeId();
    const name = window.localStorage.getItem(NAME_KEY) || makeDefaultName();
    return { id, displayName: name, registered: false };
  });

  const register = useCallback(async () => {
    try {
      const res = await fetch("/api/device", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ device_id: device.id, display_name: device.displayName }),
      });
      if (res.ok) {
        setDevice((d) => ({ ...d, registered: true }));
      }
    } catch {
      // Server unreachable — registration will retry on next connect.
    }
  }, [device.id, device.displayName]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // persist
    window.localStorage.setItem(DEVICE_KEY, device.id);
    window.localStorage.setItem(NAME_KEY, device.displayName);
    register();
  }, [device.id, device.displayName, register]);

  const setDisplayName = useCallback((name: string) => {
    setDevice((d) => ({ ...d, displayName: name.trim().slice(0, 60) }));
  }, []);

  return { device, setDisplayName };
}