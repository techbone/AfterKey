"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { AppShell } from "@/components/app-shell";
import { WalletButton } from "@/components/wallet-button";
import { CLUSTER, PROGRAM_ID, shortKey } from "@/lib/solana";
import { notificationProfile, settingsRequest, settingsSignInMessage, SettingsError, type NotificationHealth, type NotificationProfile } from "@/lib/notifications";

const actionClass = "rounded-full bg-pulse px-6 py-3 text-sm font-semibold text-[#04120b] disabled:cursor-not-allowed disabled:opacity-50";
const secondaryClass = "rounded-full border border-edge px-5 py-3 text-sm disabled:opacity-50";

export default function SettingsPage() {
  const { publicKey, signMessage } = useWallet();
  const wallet = publicKey?.toBase58(); const currentWallet = useRef(wallet); currentWallet.current = wallet;
  const [health, setHealth] = useState<NotificationHealth>();
  const [serviceError, setServiceError] = useState<string>();
  const [profile, setProfile] = useState<NotificationProfile>();
  const [email, setEmail] = useState("");
  const [enabled, setEnabled] = useState(false);
  const [reminders, setReminders] = useState(true);
  const [claims, setClaims] = useState(true);
  const [busy, setBusy] = useState<string>(); const [error, setError] = useState<string>(); const [notice, setNotice] = useState<string>();
  const [verification, setVerification] = useState<string>(); const [verificationDone, setVerificationDone] = useState(false);
  const [verificationError, setVerificationError] = useState<string>();
  const [removeReview, setRemoveReview] = useState(false);
  const serviceMatches = health?.network === "devnet" && health.programId === PROGRAM_ID.toBase58() && CLUSTER === "devnet";
  const available = serviceMatches && health?.deliveryConfigured === true;
  const signedIn = !!wallet && profile?.wallet === wallet;

  const acceptProfile = useCallback((value: NotificationProfile, expected: string) => {
    if (currentWallet.current !== expected) return;
    const next = notificationProfile(value, expected);
    setProfile(next); setEmail(next.email ?? ""); setEnabled(next.enabled); setReminders(next.checkinReminders); setClaims(next.claimAlerts);
  }, []);
  const refresh = useCallback(async (expected: string) => {
    try { acceptProfile(await settingsRequest<NotificationProfile>("/me"), expected); }
    catch (reason) { if (currentWallet.current === expected) { setProfile(undefined); if (!(reason instanceof SettingsError && reason.status === 401)) setError(reason instanceof Error ? reason.message : "Settings could not be loaded."); } }
  }, [acceptProfile]);
  const checkService = useCallback(async () => {
    setServiceError(undefined);
    try { setHealth(await settingsRequest<NotificationHealth>("/healthz")); }
    catch (reason) { setHealth(undefined); setServiceError(reason instanceof Error ? reason.message : "Email settings could not be reached."); }
  }, []);
  useEffect(() => { void checkService(); }, [checkService]);
  useEffect(() => {
    const consume = () => {
      const value = new URLSearchParams(window.location.hash.slice(1)).get("verify");
      if (!value) return;
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
      setVerification(undefined); setVerificationDone(false); setVerificationError(undefined);
      if (/^[A-Za-z0-9_-]{43}$/.test(value)) setVerification(value);
      else setVerificationError("This verification link is invalid. Request a new link from your email settings.");
    };
    consume(); window.addEventListener("hashchange", consume);
    return () => window.removeEventListener("hashchange", consume);
  }, []);
  useEffect(() => {
    setProfile(undefined); setEmail(""); setEnabled(false); setError(undefined); setNotice(undefined); setRemoveReview(false);
    if (wallet && serviceMatches) void refresh(wallet);
  }, [wallet, serviceMatches, refresh]);

  async function run(label: string, action: () => Promise<void>) {
    if (busy) return;
    setBusy(label); setError(undefined); setNotice(undefined);
    try { await action(); }
    catch (reason) {
      if (reason instanceof SettingsError && reason.status === 401) setProfile(undefined);
      setError(reason instanceof Error ? reason.message : "This settings action could not be completed.");
    } finally { setBusy(undefined); }
  }
  async function signIn() {
    if (!wallet || !signMessage || !serviceMatches) return;
    const expected = wallet;
    const value = await settingsRequest<unknown>("/auth/nonce", "POST", { wallet: expected });
    const proof = settingsSignInMessage(value, expected, window.location.origin, PROGRAM_ID.toBase58());
    if (currentWallet.current !== expected) throw new Error("Your connected wallet changed. Sign in again.");
    const signature = await signMessage(new TextEncoder().encode(proof.message));
    if (signature.length !== 64 || currentWallet.current !== expected) throw new Error("Your connected wallet changed or the signature was invalid. Sign in again.");
    let binary = ""; for (const byte of signature) binary += String.fromCharCode(byte);
    await settingsRequest("/auth/siws", "POST", { wallet: expected, nonce: proof.nonce, signature: btoa(binary) });
    if (currentWallet.current !== expected) return;
    acceptProfile(await settingsRequest<NotificationProfile>("/me"), expected);
    setNotice("Signed in. You can now manage this wallet’s email preferences.");
  }
  async function save(resend = false) {
    if (!wallet || !signedIn) return;
    const expected = wallet;
    const changed = email.trim().toLowerCase() !== profile!.email;
    const values = { enabled, checkinReminders: reminders, claimAlerts: claims, ...((changed || resend) ? { email: email.trim() } : {}) };
    const next = await settingsRequest<NotificationProfile>("/me", "PATCH", values);
    acceptProfile(next, expected);
    if (currentWallet.current === expected) setNotice(next.verifiedAt ? "Your email preferences are saved." : "Verification requested. Open the email and confirm your address. Notifications begin only after verification and opt-in.");
  }

  return <AppShell>
    <div className="max-w-2xl pt-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-pulse">Your safety net</p>
      <h1 className="mt-3 font-display text-4xl font-bold">Keep your inbox in the loop.</h1>
      <p className="mt-4 leading-relaxed text-mist">Optional check-in reminders and alerts when a claim starts. Your wallet controls the plan; email helps you remember to return.</p>
    </div>
    <div className="mt-8 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
      <div className="space-y-6">
        <section className="rounded-3xl border border-edge bg-surface p-6 sm:p-8" aria-label="Notification service status">
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-display text-lg font-bold">Email notifications</h2><span className={`rounded-full border px-3 py-1 text-xs ${available ? "border-pulse/40 text-pulse" : "border-edge text-mist"}`}>{available ? "Available on devnet" : "Not active yet"}</span></div>
          <p className="mt-3 text-sm leading-relaxed text-mist">{available ? "Verify an email address and choose the updates you want." : "Email delivery is not active yet. Your vault actions remain available, and you can check their status any time."}</p>
          {serviceError && <p className="mt-3 text-sm text-mist">{serviceError}</p>}
          {health && !serviceMatches && <p role="alert" className="mt-3 text-sm text-danger">The settings service does not match this devnet deployment. Please try again later.</p>}
          {!available && <div className="mt-4 flex flex-wrap gap-4"><button onClick={() => void checkService()} disabled={!!busy} className="text-sm text-pulse underline underline-offset-4">Check again</button><Link href="/app" className="text-sm text-mist underline underline-offset-4">Check your vaults</Link></div>}
        </section>

        {(verification || verificationDone || verificationError) && <section className="rounded-3xl border border-pulse/30 bg-pulse/5 p-6 sm:p-8" aria-label="Email verification">
          <h2 className="font-display text-xl font-bold">{verificationDone ? "Email verified" : verificationError ? "Verification link unavailable" : "Confirm your email address"}</h2>
          <p className="mt-3 text-sm text-mist">{verificationError ?? (verificationDone ? "Connect and sign in with the wallet that requested this email to review its preferences." : "This confirms access to the inbox. It does not approve a vault transaction or change any beneficiaries.")}</p>
          {!verificationDone && verification && <button disabled={!serviceMatches || !!busy} onClick={() => void run("Verifying email…", async () => { await settingsRequest("/me/verify-email", "POST", { token: verification }); setVerification(undefined); setVerificationDone(true); if (wallet) await refresh(wallet); })} className={actionClass + " mt-5"}>{busy === "Verifying email…" ? busy : "Verify email"}</button>}
        </section>}

        <section className="rounded-3xl border border-edge bg-surface p-6 sm:p-8" aria-label="Wallet email preferences">
          <h2 className="font-display text-xl font-bold">{signedIn ? "Your email preferences" : "Start with your wallet"}</h2>
          {!wallet ? <><p className="mt-3 text-sm text-mist">Connect the owner wallet to manage its email preferences.</p><div className="mt-5"><WalletButton /></div></>
            : !signedIn ? <><p className="mt-3 text-sm leading-relaxed text-mist">Approve one sign-in message for wallet <span className="font-mono text-snow">{shortKey(wallet, 6)}</span>. It lasts one hour and grants access to email settings.</p><p className="mt-3 text-xs text-mist">No SOL fee. No permission to move funds. Read the message in your wallet before signing.</p><button disabled={!serviceMatches || !signMessage || !!busy} onClick={() => void run("Waiting for wallet…", signIn)} className={actionClass + " mt-5"}>{busy === "Waiting for wallet…" ? busy : "Sign in to settings"}</button>{!signMessage && <p className="mt-3 text-sm text-mist">This wallet does not support message signing. Use a compatible wallet to manage email settings.</p>}</>
            : <>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs"><span className="font-mono text-mist">{shortKey(wallet, 6)}</span><button onClick={() => void run("Signing out…", async () => { await settingsRequest("/auth/logout", "POST", {}); setProfile(undefined); setNotice("Signed out of settings. Your saved preferences remain."); })} disabled={!!busy} className="text-mist underline underline-offset-4">Sign out of settings</button></div>
              <form className="mt-6" onSubmit={event => { event.preventDefault(); void run("Saving preferences…", () => save()); }}>
                <label htmlFor="notification-email" className="text-sm font-semibold">Email address</label>
                <input id="notification-email" type="email" required maxLength={254} autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} disabled={!!busy || !available} placeholder="you@example.com" className="mt-2 w-full min-w-0 rounded-xl border border-edge bg-ink px-4 py-3 text-sm disabled:opacity-50" />
                <p className="mt-2 text-xs text-mist">{profile?.email ? profile.verifiedAt ? "Verified address" : "Awaiting email verification" : "Only used for the updates you choose."}</p>
                <div className="mt-6 space-y-4 rounded-2xl border border-edge bg-ink/40 p-5">
                  <Preference label="Email notifications" description="Allow verified reminders and claim alerts for this wallet." value={enabled} onChange={setEnabled} disabled={!!busy || (!available && !profile?.enabled)} />
                  <Preference label="Check-in reminders" description="Reminders at 50%, 80% and 95% of the inactivity period." value={reminders} onChange={setReminders} disabled={!!busy || !available} />
                  <Preference label="Claim alerts" description="An alert when an inheritance claim starts." value={claims} onChange={setClaims} disabled={!!busy || !available} />
                </div>
                <div className="mt-5 flex flex-wrap gap-3"><button disabled={!!busy || (!available && enabled)} className={actionClass}>{busy === "Saving preferences…" ? busy : "Save preferences"}</button>{profile?.email && !profile.verifiedAt && <button type="button" disabled={!!busy || !available} onClick={() => void run("Requesting verification…", () => save(true))} className={secondaryClass}>Resend verification</button>}</div>
              </form>
              <div className="mt-6 border-t border-edge pt-5">{!removeReview ? <button disabled={!!busy} onClick={() => setRemoveReview(true)} className="text-sm text-mist underline underline-offset-4">Remove my email settings</button> : <><p className="text-sm text-mist">Remove the saved email, preferences and settings sessions for this wallet? Pending notifications will stop.</p><div className="mt-4 flex flex-wrap gap-3"><button disabled={!!busy} onClick={() => void run("Removing settings…", async () => { await settingsRequest("/me", "DELETE", {}); setProfile(undefined); setRemoveReview(false); setNotice("Your email settings were removed. Pending notifications will not be sent."); })} className="rounded-full border border-danger/40 px-5 py-3 text-sm text-danger">Remove settings</button><button disabled={!!busy} onClick={() => setRemoveReview(false)} className={secondaryClass}>Keep settings</button></div></>}</div>
            </>}
          {busy && <p role="status" className="mt-5 text-sm text-mist">{busy}</p>}
          {error && <p role="alert" className="mt-5 rounded-xl border border-danger/25 bg-danger/5 p-4 text-sm text-danger">{error}</p>}
          {notice && <p role="status" className="mt-5 rounded-xl border border-pulse/25 bg-pulse/5 p-4 text-sm text-pulse">{notice}</p>}
        </section>
      </div>
      <aside className="space-y-5">
        <div className="rounded-3xl border border-edge p-6"><span className="text-xs font-semibold uppercase tracking-wide text-pulse">Always in your control</span><h2 className="mt-3 font-display text-xl font-bold">An inbox is a reminder.</h2><p className="mt-3 text-sm leading-relaxed text-mist">Delivery can be delayed or unavailable. Check your on-chain deadlines and return to AfterKey regularly. Only a wallet transaction can check in or veto a claim.</p><Link href="/security" className="mt-5 inline-block text-sm text-pulse underline underline-offset-4">How you’re protected ↗</Link></div>
        <div className="rounded-3xl border border-edge p-6"><h2 className="font-display text-lg font-bold">Private by choice</h2><p className="mt-3 text-sm leading-relaxed text-mist">Your email stays off-chain. AfterKey uses it only for verification and opted-in updates. You can turn notifications off or remove your email settings here.</p><p className="mt-4 text-xs leading-relaxed text-mist">Emails never ask for a seed phrase or private key. Open AfterKey directly if you are unsure about a message.</p></div>
      </aside>
    </div>
  </AppShell>;
}

function Preference({ label, description, value, onChange, disabled }: { label: string; description: string; value: boolean; onChange: (value: boolean) => void; disabled: boolean }) {
  return <label className="flex cursor-pointer items-start gap-3"><input type="checkbox" checked={value} onChange={event => onChange(event.target.checked)} disabled={disabled} className="mt-1 h-4 w-4 shrink-0 accent-pulse" /><span><span className="block text-sm font-semibold">{label}</span><span className="mt-1 block text-xs leading-relaxed text-mist">{description}</span></span></label>;
}
