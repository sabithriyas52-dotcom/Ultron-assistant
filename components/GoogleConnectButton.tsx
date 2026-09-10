"use client";

import { signIn, signOut, useSession } from "next-auth/react";

export function GoogleConnectButton() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return null;
  }

  if (session) {
    return (
      <button onClick={() => signOut()}>
        Disconnect Google ({session.user?.email})
      </button>
    );
  }

  return (
    <button onClick={() => signIn("google")}>
      Connect Google Calendar &amp; Gmail
    </button>
  );
}