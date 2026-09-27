// #1452: the turn path must consult external memory providers.
// contextMemory used memory.read(scope), which on a routed service reaches only
// the managing route (the built-in notebook), so mcp/memorable providers were
// parsed, validated and never called on a turn.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRoutedMemoryService } from "../src/memory/provider-router.ts";
import { contextMemory } from "../src/resolution/turn-context.ts";
import type { MemoryRecallContext, MemoryService } from "../src/memory/memory-service.ts";

function provider(name: string, calls: string[]): MemoryService {
  return {
    async recall(scope, context?: MemoryRecallContext) {
      calls.push(`${name}:recall:${scope}:${context?.query ?? ""}:${context?.actorId ?? ""}`);
      return `${name} memory`;
    },
    async capture(_scope, facts) {
      return facts.length;
    },
    async query() {
      return [];
    },
    async read() {
      calls.push(`${name}:read`);
      return `${name} notebook`;
    },
    async replace() {},
  };
}

test("turn recall fans out to external providers with the turn's query and actor", async () => {
  const calls: string[] = [];
  const memory = createRoutedMemoryService({
    providers: { notebook: provider("notebook", calls), brain: provider("brain", calls) },
    routes: [
      { provider: "notebook", scopes: ["personal"], capture: "automatic" },
      { provider: "brain", scopes: ["personal"], capture: "explicit", manage: false },
    ],
  });
  const recalled = await contextMemory({ memory, scopes: ["personal:u1"], actorId: "u1" }).recall({
    query: "who owns project forge",
  });
  assert.match(recalled, /notebook memory/);
  assert.match(recalled, /brain memory/, "external provider must be consulted on a turn");
  assert.ok(calls.includes("brain:recall:personal:u1:who owns project forge:u1"));
  assert.ok(!calls.some((c) => c.endsWith(":read")), "turn recall must not fall back to read()");
});
