# Demo Video Script — Proof of Life

Target: 2:30–3:00, 1080p, 16:9. Built around the actual devnet-timing app (2-min/1-min presets) so nothing here is faked.

## Priority rule for X specifically

**X autoplays muted in-feed.** Most people will watch this with no sound while scrolling. That means **burnt-in captions/on-screen text are more important than voiceover** — voiceover is a nice layer for people who tap to unmute, but the video must tell the whole story silently through text + visuals alone. Every beat below has a caption line — treat those as required, the voiceover as optional.

## Tools

- **Recording:** QuickTime (free, Cmd+Shift+5) is fine. If you want the polished cursor-follow zoom effect you see in slick product demos, **Screen Studio** (paid, Mac) is the popular choice and worth it for a launch video.
- **Editing + captions:** **CapCut** (free) — auto-captions, easy text overlays, exports directly in X's preferred format. iMovie works too but CapCut's caption tooling is faster.
- **Music:** subtle, moody, low-key ambient — not meme music. YouTube Audio Library or Epidemic Sound, filter for "minimal / tension / corporate calm." Should build very slightly during the silence/countdown beats and resolve when the inheritance completes.

## Before you record — setup checklist

- [ ] Two Phantom accounts, **renamed** in Phantom itself: one "Owner", one "Heir" — makes the recording self-explanatory without you narrating "this is the owner's wallet."
- [ ] Both funded with devnet SOL.
- [ ] Phantom set to devnet (Settings → Developer Settings → Testnet Mode).
- [ ] Mac in dark mode (matches the app's theme).
- [ ] Do Not Disturb ON — no notification banners mid-recording.
- [ ] Browser: clean profile, bookmarks bar hidden, only one tab, zoomed to ~110% so text reads well at video resolution.
- [ ] `npm run dev -w apps/web` running against devnet, or better — record against your live Vercel deploy so the URL bar shows a real link, not `localhost`.

## Shot list

**0:00–0:10 — The hook**
Screen: landing page hero, static, before scrolling.
Caption (large, bold): **"If you died tonight, what happens to your SOL?"**
Voiceover (optional): *"Every year, billions in crypto become permanently unreachable — because the owner never shared their keys."*
Do not show your logo or a title card first. Open cold on the question.

**0:10–0:20 — The problem, fast**
Screen: scroll the landing page to the "what we can never do" section.
Caption: *"Wills can't sign transactions. Sharing your seed phrase is a loaded gun."*

**0:20–0:35 — Connect + create**
Screen: click "Launch App" → connect **Owner** wallet → click "+ New vault".
Caption: *"Proof of Life: a non-custodial dead-man's switch on Solana."*

**0:35–1:00 — The wizard**
Screen: pick "2 minutes (demo)" inactivity, "1 minute (demo)" challenge, paste the **Heir** wallet address at 100%, set deposit to 0.1 SOL. Let the plain-language summary box sit on screen for a beat — it's a strong visual proof point.
Caption: *"You set the timer. You choose who inherits. You keep control."*
Click Create → sign in Phantom (let the popup show briefly, it's good authenticity).

**1:00–1:15 — The dashboard, alive**
Screen: dashboard with the countdown decaying (green).
Caption: *"While you're alive, nothing happens — and you can prove it anytime."*
Click **"I'm alive"** → sign → timer visibly resets.

**1:15–1:25 — Time-lapse the silence**
Cut to a sped-up clip (2–3x, or a hard jump-cut) of the countdown running down and turning red.
Caption (holds through the cut): **"2 minutes later — no check-in."**
End on the red "Claimable now" state.

**1:25–1:45 — The heir's side**
Screen: switch to the **Heir** browser profile, open `/claim` — the vault appears.
Caption: *"If you go silent, your beneficiary can start a claim."*
Click **"Start a claim"** → sign. Cut immediately to the **Owner's** dashboard showing the red **"⚠ A claim is in progress"** banner.
Caption: *"But you get one last chance to say you're still here."*

**1:45–1:55 — The twist: veto**
Screen: Owner clicks **"I'm alive — cancel this claim"** → sign → banner disappears, vault back to Active.
Caption: **"One signature. Claim cancelled."**
(This beat is what makes the video a story, not a feature list — don't cut it for time.)

**1:55–2:05 — Time-lapse again, for real this time**
Cut: countdown resets, time-lapses down again, heir re-initiates, challenge countdown time-lapses to zero.
Caption: **"This time, no one answers."**

**2:05–2:20 — Completion**
Screen: Heir clicks "Complete the inheritance" → sign → then "Receive inheritance" → sign. Cut to Phantom or the Solana Explorer showing the SOL landing in the Heir's wallet.
Caption: **"Assets released — without us, without a key ever changing hands."**
Voiceover (optional, this is the line to say out loud if you say anything): *"No company was needed to complete this. Anyone could have finished it."*

**2:20–2:35 — End card**
Screen: static frame — logo, one line, one link.
Text on screen:
```
Proof of Life
Crypto inheritance, without sharing your keys.
Live on Solana devnet — try it: [your vercel URL]
```
No fade-to-black long outro. Cut clean.

## Posting on X

Post as a short thread from your **personal** account:

1. **Tweet 1:** the video, with just the hook line as the tweet text — *"If you died tonight, what happens to your SOL?"* — let the video do the rest.
2. **Tweet 2:** 3–4 bullet points — non-custodial, permissionless completion (no company required to finish an inheritance), open-source program, live on devnet.
3. **Tweet 3:** the link to try it + a link to the GitHub repo (once the program subset is public) or docs.

Skip hashtags — crypto Twitter reads them as noise, not reach. Tag Solana Foundation / Superteam / Colosseum accounts only if you're already engaging with them, not cold.
