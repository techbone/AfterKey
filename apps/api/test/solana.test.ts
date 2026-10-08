import assert from "node:assert/strict";
import test from "node:test";
import { Connection, PublicKey } from "@solana/web3.js";
import { SolanaVaultSource } from "../src/solana.js";

test("notification reads accept devnet and reject other networks or a missing program", async t => {
  let genesis = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
  let executable = true;
  const network = t.mock.method(Connection.prototype, "getGenesisHash", async () => genesis);
  const program = t.mock.method(Connection.prototype, "getAccountInfo", async () => ({ executable, owner: PublicKey.default, lamports: 1, data: Buffer.alloc(0) }));
  const source = new SolanaVaultSource("http://127.0.0.1:8899");
  await source.ready();
  genesis = "5eykt4UsFv8P8NJdTREpY1vzqKqZKvdpKuc147dw2N9d";
  await assert.rejects(source.ready(), /devnet only/);
  assert.equal(program.mock.calls.length, 1, "Wrong-network reads must stop before inspecting accounts");
  genesis = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";
  executable = false;
  await assert.rejects(source.ready(), /not executable/);
  assert.equal(network.mock.calls.length, 3);
});
