/**
 * State-machine × signer matrix (docs/smart-contracts.md §10).
 * Every instruction attempted from every reachable state by every signer
 * class; invalid cells must fail with the EXACT PolError code. Plus timing
 * boundary tests (`>` semantics) and the pause-asymmetry invariant.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { BN } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import {
  CHALLENGE,
  INACTIVITY,
  SOL,
  createVault,
  defaultBeneficiaries,
  expectError,
  fetchVault,
  newWorld,
  toInChallenge,
  toReleased,
  warp,
  warpTo,
  type World,
} from "./helpers.ts";

const DEPOSIT = new BN(10 * SOL);

test("initialize_vault validation", async (t) => {
  const w = await newWorld();

  const init = (inactivity: BN, challenge: BN, beneficiaries: unknown[]) =>
    w.program.methods
      .initializeVault(new BN(w.nextVaultId++), inactivity, challenge, beneficiaries)
      .accounts({ owner: w.owner.publicKey })
      .rpc();

  await t.test("inactivity below minimum", () =>
    expectError(init(new BN(86_400), CHALLENGE, defaultBeneficiaries(w)), "InvalidPeriod"));
  await t.test("challenge below minimum", () =>
    expectError(init(INACTIVITY, new BN(60), defaultBeneficiaries(w)), "InvalidPeriod"));
  await t.test("inactivity above 10y cap", () =>
    expectError(init(new BN(11 * 365 * 86_400), CHALLENGE, defaultBeneficiaries(w)), "InvalidPeriod"));
  await t.test("empty beneficiaries", () =>
    expectError(init(INACTIVITY, CHALLENGE, []), "NoBeneficiaries"));
  await t.test("more than 10 beneficiaries", () => {
    const eleven = Array.from({ length: 11 }, (_, i) => ({
      key: Keypair.generate().publicKey,
      shareBps: i === 10 ? 1000 - 0 : 900, // 10×900 + 1000 = 10000
    }));
    return expectError(init(INACTIVITY, CHALLENGE, eleven), "TooManyBeneficiaries");
  });
  await t.test("duplicate beneficiary", () =>
    expectError(
      init(INACTIVITY, CHALLENGE, [
        { key: w.heirA.publicKey, shareBps: 5000 },
        { key: w.heirA.publicKey, shareBps: 5000 },
      ]),
      "DuplicateBeneficiary",
    ));
  await t.test("owner as beneficiary", () =>
    expectError(
      init(INACTIVITY, CHALLENGE, [
        { key: w.owner.publicKey, shareBps: 5000 },
        { key: w.heirA.publicKey, shareBps: 5000 },
      ]),
      "OwnerCannotBeBeneficiary",
    ));
  await t.test("shares must sum to 10000", () =>
    expectError(
      init(INACTIVITY, CHALLENGE, [
        { key: w.heirA.publicKey, shareBps: 9000 },
        { key: w.heirB.publicKey, shareBps: 999 },
      ]),
      "SharesMustSum10000",
    ));
});

test("check_in matrix", async (t) => {
  const w = await newWorld();

  await t.test("owner × Active → ok, resets timer", async () => {
    const v = await createVault(w);
    const before = (await fetchVault(w, v)).lastCheckin;
    warp(w, 1000);
    await w.program.methods.checkIn().accounts({ vault: v.vault }).rpc();
    const after = (await fetchVault(w, v)).lastCheckin;
    assert.ok(after.gt(before), "last_checkin must advance");
  });

  await t.test("beneficiary × Active → NotOwner", async () => {
    const v = await createVault(w);
    await expectError(
      w.program.methods
        .checkIn()
        .accounts({ owner: w.heirA.publicKey, vault: v.vault })
        .signers([w.heirA])
        .rpc(),
      "NotOwner",
    );
  });

  await t.test("stranger × Active → NotOwner", async () => {
    const v = await createVault(w);
    await expectError(
      w.program.methods
        .checkIn()
        .accounts({ owner: w.stranger.publicKey, vault: v.vault })
        .signers([w.stranger])
        .rpc(),
      "NotOwner",
    );
  });

  await t.test("owner × InChallenge → ok AND vetoes the claim", async () => {
    const v = await createVault(w);
    await toInChallenge(w, v);
    await w.program.methods.checkIn().accounts({ vault: v.vault }).rpc();
    const s = await fetchVault(w, v);
    assert.deepEqual(s.state, { active: {} });
    assert.equal(s.claimInitiatedAt.toNumber(), 0);
  });

  await t.test("owner × Released → WrongState", async () => {
    const v = await createVault(w);
    await toReleased(w, v);
    await expectError(
      w.program.methods.checkIn().accounts({ vault: v.vault }).rpc(),
      "WrongState",
    );
  });
});

test("update_config matrix", async (t) => {
  const w = await newWorld();

  await t.test("owner × Active → ok, resets timer", async () => {
    const v = await createVault(w);
    const before = (await fetchVault(w, v)).lastCheckin;
    warp(w, 1000);
    await w.program.methods
      .updateConfig([{ key: w.heirB.publicKey, shareBps: 10000 }], null, null)
      .accounts({ owner: w.owner.publicKey, vault: v.vault })
      .rpc();
    const s = await fetchVault(w, v);
    assert.equal(s.beneficiaries.length, 1);
    assert.ok(s.lastCheckin.gt(before));
  });

  await t.test("non-owner → NotOwner", async () => {
    const v = await createVault(w);
    await expectError(
      w.program.methods
        .updateConfig(null, null, null)
        .accounts({ owner: w.heirA.publicKey, vault: v.vault })
        .signers([w.heirA])
        .rpc(),
      "NotOwner",
    );
  });

  await t.test("owner × InChallenge → WrongState (config frozen)", async () => {
    const v = await createVault(w);
    await toInChallenge(w, v);
    await expectError(
      w.program.methods
        .updateConfig([{ key: w.stranger.publicKey, shareBps: 10000 }], null, null)
        .accounts({ owner: w.owner.publicKey, vault: v.vault })
        .rpc(),
      "WrongState",
    );
  });

  await t.test("owner × Released → WrongState", async () => {
    const v = await createVault(w);
    await toReleased(w, v);
    await expectError(
      w.program.methods
        .updateConfig(null, null, null)
        .accounts({ owner: w.owner.publicKey, vault: v.vault })
        .rpc(),
      "WrongState",
    );
  });

  await t.test("invalid new period → InvalidPeriod", async () => {
    const v = await createVault(w);
    await expectError(
      w.program.methods
        .updateConfig(null, new BN(60), null)
        .accounts({ owner: w.owner.publicKey, vault: v.vault })
        .rpc(),
      "InvalidPeriod",
    );
  });

  await t.test("invalid new beneficiaries → exact codes", async () => {
    const v = await createVault(w);
    const upd = (b: unknown[]) =>
      w.program.methods
        .updateConfig(b, null, null)
        .accounts({ owner: w.owner.publicKey, vault: v.vault })
        .rpc();
    await expectError(upd([]), "NoBeneficiaries");
    await expectError(
      upd([{ key: w.owner.publicKey, shareBps: 10000 }]),
      "OwnerCannotBeBeneficiary",
    );
    await expectError(
      upd([
        { key: w.heirA.publicKey, shareBps: 5000 },
        { key: w.heirA.publicKey, shareBps: 5000 },
      ]),
      "DuplicateBeneficiary",
    );
  });
});

test("deposit_sol / withdraw_sol matrix", async (t) => {
  const w = await newWorld();

  await t.test("deposit: non-owner → NotOwner", async () => {
    const v = await createVault(w);
    await expectError(
      w.program.methods
        .depositSol(new BN(SOL))
        .accounts({ owner: w.stranger.publicKey, vault: v.vault })
        .signers([w.stranger])
        .rpc(),
      "NotOwner",
    );
  });

  await t.test("deposit × InChallenge → WrongState", async () => {
    const v = await createVault(w, { depositSol: DEPOSIT });
    await toInChallenge(w, v);
    await expectError(
      w.program.methods.depositSol(new BN(SOL)).accounts({ vault: v.vault }).rpc(),
      "WrongState",
    );
  });

  await t.test("withdraw × Active → ok (partial)", async () => {
    const v = await createVault(w, { depositSol: DEPOSIT });
    await w.program.methods.withdrawSol(new BN(SOL)).accounts({ vault: v.vault }).rpc();
    assert.equal(w.client.getBalance(v.solEscrow), BigInt(9 * SOL));
  });

  await t.test("withdraw more than balance → InsufficientFunds", async () => {
    const v = await createVault(w, { depositSol: DEPOSIT });
    await expectError(
      w.program.methods
        .withdrawSol(DEPOSIT.add(new BN(1)))
        .accounts({ vault: v.vault })
        .rpc(),
      "InsufficientFunds",
    );
  });

  await t.test("withdraw: non-owner → NotOwner", async () => {
    const v = await createVault(w, { depositSol: DEPOSIT });
    await expectError(
      w.program.methods
        .withdrawSol(new BN(SOL))
        .accounts({ owner: w.heirA.publicKey, vault: v.vault })
        .signers([w.heirA])
        .rpc(),
      "NotOwner",
    );
  });

  await t.test("withdraw × InChallenge → ok AND auto-vetoes", async () => {
    const v = await createVault(w, { depositSol: DEPOSIT });
    await toInChallenge(w, v);
    await w.program.methods.withdrawSol(new BN(SOL)).accounts({ vault: v.vault }).rpc();
    const s = await fetchVault(w, v);
    assert.deepEqual(s.state, { active: {} });
    assert.equal(s.claimInitiatedAt.toNumber(), 0);
  });

  await t.test("deposit & withdraw × Released → WrongState", async () => {
    const v = await createVault(w, { depositSol: DEPOSIT });
    await toReleased(w, v);
    await expectError(
      w.program.methods.depositSol(new BN(SOL)).accounts({ vault: v.vault }).rpc(),
      "WrongState",
    );
    await expectError(
      w.program.methods.withdrawSol(new BN(SOL)).accounts({ vault: v.vault }).rpc(),
      "WrongState",
    );
  });
});

test("claim flow matrix", async (t) => {
  const w = await newWorld();

  await t.test("owner cannot claim own vault → NotBeneficiary", async () => {
    const v = await createVault(w);
    warp(w, INACTIVITY.toNumber() + 2);
    await expectError(
      w.program.methods
        .initiateClaim()
        .accounts({ claimer: w.owner.publicKey, vault: v.vault })
        .rpc(),
      "NotBeneficiary",
    );
  });

  await t.test("second claim while InChallenge → WrongState", async () => {
    const v = await createVault(w);
    await toInChallenge(w, v);
    await expectError(
      w.program.methods
        .initiateClaim()
        .accounts({ claimer: w.heirB.publicKey, vault: v.vault })
        .signers([w.heirB])
        .rpc(),
      "WrongState",
    );
  });

  await t.test("claim on Released vault → WrongState", async () => {
    const v = await createVault(w);
    await toReleased(w, v);
    await expectError(
      w.program.methods
        .initiateClaim()
        .accounts({ claimer: w.heirB.publicKey, vault: v.vault })
        .signers([w.heirB])
        .rpc(),
      "WrongState",
    );
  });

  await t.test("veto × Active → WrongState; by non-owner → NotOwner", async () => {
    const v = await createVault(w);
    await expectError(
      w.program.methods.vetoClaim().accounts({ vault: v.vault }).rpc(),
      "WrongState",
    );
    await toInChallenge(w, v);
    await expectError(
      w.program.methods
        .vetoClaim()
        .accounts({ owner: w.heirA.publicKey, vault: v.vault })
        .signers([w.heirA])
        .rpc(),
      "NotOwner",
    );
    // real owner veto works
    await w.program.methods.vetoClaim().accounts({ vault: v.vault }).rpc();
    assert.deepEqual((await fetchVault(w, v)).state, { active: {} });
  });

  await t.test("finalize × Active/Released → WrongState; beneficiary can crank", async () => {
    const v = await createVault(w);
    await expectError(
      w.program.methods
        .finalizeClaim()
        .accounts({ cranker: w.stranger.publicKey, vault: v.vault })
        .signers([w.stranger])
        .rpc(),
      "WrongState",
    );
    await toInChallenge(w, v);
    warp(w, CHALLENGE.toNumber() + 2);
    await w.program.methods
      .finalizeClaim()
      .accounts({ cranker: w.heirB.publicKey, vault: v.vault })
      .signers([w.heirB])
      .rpc();
    assert.deepEqual((await fetchVault(w, v)).state, { released: {} });
    await expectError(
      w.program.methods
        .finalizeClaim()
        .accounts({ cranker: w.stranger.publicKey, vault: v.vault })
        .signers([w.stranger])
        .rpc(),
      "WrongState",
    );
  });
});

test("timing boundaries (strict > semantics)", async (t) => {
  const w = await newWorld();

  await t.test("claim at exact deadline fails; +1s succeeds", async () => {
    const v = await createVault(w);
    const s = await fetchVault(w, v);
    const deadline = BigInt(s.lastCheckin.add(INACTIVITY).toString());
    const claim = () =>
      w.program.methods
        .initiateClaim()
        .accounts({ claimer: w.heirA.publicKey, vault: v.vault })
        .signers([w.heirA])
        .rpc();
    warpTo(w, deadline);
    await expectError(claim(), "InactivityPeriodNotElapsed");
    warpTo(w, deadline + 1n);
    await claim();
    assert.deepEqual((await fetchVault(w, v)).state, { inChallenge: {} });
  });

  await t.test("finalize at exact challenge end fails; +1s succeeds", async () => {
    const v = await createVault(w);
    await toInChallenge(w, v);
    const s = await fetchVault(w, v);
    const deadline = BigInt(s.claimInitiatedAt.add(CHALLENGE).toString());
    const finalize = () =>
      w.program.methods
        .finalizeClaim()
        .accounts({ cranker: w.stranger.publicKey, vault: v.vault })
        .signers([w.stranger])
        .rpc();
    warpTo(w, deadline);
    await expectError(finalize(), "ChallengeNotElapsed");
    warpTo(w, deadline + 1n);
    await finalize();
    assert.deepEqual((await fetchVault(w, v)).state, { released: {} });
  });
});

test("distribute_sol adversarial", async (t) => {
  const w = await newWorld();

  await t.test("wrong state → WrongState", async () => {
    const v = await createVault(w, { depositSol: DEPOSIT });
    const distribute = () =>
      w.program.methods
        .distributeSol()
        .accounts({ cranker: w.stranger.publicKey, vault: v.vault })
        .remainingAccounts([
          { pubkey: w.heirA.publicKey, isSigner: false, isWritable: true },
          { pubkey: w.heirB.publicKey, isSigner: false, isWritable: true },
        ])
        .signers([w.stranger])
        .rpc();
    await expectError(distribute(), "WrongState");
    await toInChallenge(w, v);
    await expectError(distribute(), "WrongState");
  });

  await t.test("wrong recipient count / order / substitution → NotBeneficiary", async () => {
    const v = await createVault(w, { depositSol: DEPOSIT });
    await toReleased(w, v);
    const distribute = (recipients: { pubkey: typeof w.heirA.publicKey }[]) =>
      w.program.methods
        .distributeSol()
        .accounts({ cranker: w.stranger.publicKey, vault: v.vault })
        .remainingAccounts(
          recipients.map((r) => ({ pubkey: r.pubkey, isSigner: false, isWritable: true })),
        )
        .signers([w.stranger])
        .rpc();
    await expectError(distribute([{ pubkey: w.heirA.publicKey }]), "NotBeneficiary");
    await expectError(
      distribute([{ pubkey: w.heirB.publicKey }, { pubkey: w.heirA.publicKey }]),
      "NotBeneficiary",
    );
    await expectError(
      distribute([{ pubkey: w.heirA.publicKey }, { pubkey: w.stranger.publicKey }]),
      "NotBeneficiary",
    );
    // correct order succeeds, second run is a no-op (idempotent on empty)
    await distribute([{ pubkey: w.heirA.publicKey }, { pubkey: w.heirB.publicKey }]);
    warp(w, 10);
    await distribute([{ pubkey: w.heirA.publicKey }, { pubkey: w.heirB.publicKey }]);
  });
});

test("close_vault matrix", async (t) => {
  const w = await newWorld();

  await t.test("with funds → VaultNotEmpty; after withdraw-all → ok", async () => {
    const v = await createVault(w, { depositSol: DEPOSIT });
    await expectError(
      w.program.methods
        .closeVault()
        .accounts({ owner: w.owner.publicKey, vault: v.vault })
        .rpc(),
      "VaultNotEmpty",
    );
    await w.program.methods.withdrawSol(DEPOSIT).accounts({ vault: v.vault }).rpc();
    warp(w, 1); // new blockhash — retry would otherwise dedupe with the failed attempt
    await w.program.methods
      .closeVault()
      .accounts({ owner: w.owner.publicKey, vault: v.vault })
      .rpc();
    await assert.rejects(fetchVault(w, v)); // account gone
  });

  await t.test("non-owner → NotOwner", async () => {
    const v = await createVault(w);
    await expectError(
      w.program.methods
        .closeVault()
        .accounts({ owner: w.heirA.publicKey, vault: v.vault })
        .signers([w.heirA])
        .rpc(),
      "NotOwner",
    );
  });

  await t.test("InChallenge / Released → WrongState", async () => {
    const v1 = await createVault(w);
    await toInChallenge(w, v1);
    await expectError(
      w.program.methods
        .closeVault()
        .accounts({ owner: w.owner.publicKey, vault: v1.vault })
        .rpc(),
      "WrongState",
    );
    const v2 = await createVault(w);
    await toReleased(w, v2);
    await expectError(
      w.program.methods
        .closeVault()
        .accounts({ owner: w.owner.publicKey, vault: v2.vault })
        .rpc(),
      "WrongState",
    );
  });
});

test("admin config & pause asymmetry", async (t) => {
  const w = await newWorld();

  await t.test("non-admin cannot touch config", async () => {
    await expectError(
      w.program.methods
        .updateAdminConfig(true, null, null, null)
        .accounts({ admin: w.stranger.publicKey })
        .signers([w.stranger])
        .rpc(),
      "ConstraintHasOne",
    );
  });

  await t.test("pause blocks ONLY new vaults + deposits — never life or claims", async () => {
    // a claimable vault and a fresh vault, prepared before pausing
    const claimable = await createVault(w, { depositSol: DEPOSIT });
    warp(w, INACTIVITY.toNumber() + 2);
    const fresh = await createVault(w, { depositSol: DEPOSIT });

    await w.program.methods.updateAdminConfig(true, null, null, null).rpc();

    // blocked: new risk intake
    await expectError(
      w.program.methods
        .initializeVault(new BN(w.nextVaultId++), INACTIVITY, CHALLENGE, defaultBeneficiaries(w))
        .accounts({ owner: w.owner.publicKey })
        .rpc(),
      "Paused",
    );
    await expectError(
      w.program.methods.depositSol(new BN(SOL)).accounts({ vault: fresh.vault }).rpc(),
      "Paused",
    );

    // NEVER blocked: check-in, withdraw, the whole claim flow
    await w.program.methods.checkIn().accounts({ vault: fresh.vault }).rpc();
    await w.program.methods.withdrawSol(new BN(SOL)).accounts({ vault: fresh.vault }).rpc();
    await w.program.methods
      .initiateClaim()
      .accounts({ claimer: w.heirA.publicKey, vault: claimable.vault })
      .signers([w.heirA])
      .rpc();
    await w.program.methods.vetoClaim().accounts({ vault: claimable.vault }).rpc();

    await w.program.methods.updateAdminConfig(false, null, null, null).rpc();
  });
});
