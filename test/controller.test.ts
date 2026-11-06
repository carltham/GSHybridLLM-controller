import { test } from "node:test";
import assert from "node:assert/strict";
import {
  generateWithOllama, parsePlan, runTask, supervisorSessionConfig,
  type ControllerPorts,
} from "../src/controller.js";

const validPlan = '{"tasks":[{"instruction":"Suggest a small function."}]}';
function ports(overrides: Partial<ControllerPorts> = {}): ControllerPorts {
  return {
    approveCloud: async () => true,
    plan: async () => validPlan,
    approveLocal: async () => true,
    generate: async () => "A local answer",
    ...overrides,
  };
}

test("cloud approval is required before any provider call", async () => {
  let calls = 0;
  await assert.rejects(runTask("Explain a function", "PRIVATE", ports({
    approveCloud: async () => false,
    plan: async () => { calls++; return validPlan; },
    generate: async () => { calls++; return "answer"; },
  })), /No cloud call/);
  assert.equal(calls, 0);
});

test("local context and answers are never sent to cloud", async () => {
  const cloudRequests: string[] = [];
  const result = await runTask("Suggest a function", "PRIVATE SOURCE", ports({
    plan: async (request) => { cloudRequests.push(request); return validPlan; },
    generate: async (instruction, context) => {
      assert.equal(instruction, "Suggest a small function.");
      assert.equal(context, "PRIVATE SOURCE");
      return "PRIVATE ANSWER";
    },
  }));
  assert.deepEqual(cloudRequests, ["Suggest a function"]);
  assert.equal(result[0]?.output, "PRIVATE ANSWER");
});

test("local execution needs separate approval", async () => {
  let called = false;
  await assert.rejects(runTask("Task", "", ports({
    approveLocal: async () => false,
    generate: async () => { called = true; return "answer"; },
  })), /Ollama was not called/);
  assert.equal(called, false);
});

test("invalid plans and oversized instructions fail closed", () => {
  for (const plan of [
    "not JSON", "null", '{"tasks":[]}', '{"tasks":[{"command":"rm"}]}',
    '{"tasks":[{"instruction":"x"}],"extra":true}',
    JSON.stringify({ tasks: Array.from({ length: 4 }, () => ({ instruction: "x" })) }),
    JSON.stringify({ tasks: [{ instruction: "x".repeat(4001) }] }),
  ]) {
    assert.throws(() => parsePlan(plan));
  }
  assert.equal(parsePlan(validPlan).tasks.length, 1);
});

test("oversized inputs fail before approval or networking", async () => {
  let called = false;
  const mock = ports({ approveCloud: async () => { called = true; return true; } });
  await assert.rejects(runTask("x".repeat(4001), "", mock), /4000/);
  await assert.rejects(runTask("Task", "x".repeat(64001), mock), /64000/);
  assert.equal(called, false);
});

test("cloud session has no tools, discovery, telemetry or host git access", async () => {
  const config = supervisorSessionConfig("chosen-model");
  assert.deepEqual(config.availableTools, []);
  assert.deepEqual(config.excludedTools, ["builtin:*", "mcp:*", "custom:*"]);
  assert.equal(config.enableConfigDiscovery, false);
  assert.equal(config.enableFileHooks, false);
  assert.equal(config.enableHostGitOperations, false);
  assert.equal(config.enableSessionStore, false);
  assert.equal(config.enableSkills, false);
  assert.equal(config.enableSessionTelemetry, false);
  assert.equal(config.systemMessage?.mode, "replace");
  assert.ok(config.onPermissionRequest);
  const denied = await config.onPermissionRequest(
    {
      kind: "write",
      canOfferSessionApproval: false,
      diff: "",
      fileName: "/not-a-real-target",
      intention: "Test that writes are denied",
    },
    { sessionId: "test-session" },
  );
  assert.equal(denied.kind, "denied-no-approval-rule-and-could-not-request-from-user");
});

test("Ollama uses loopback only, bounded generation and local context", async () => {
  const mock: typeof fetch = async (url, init) => {
    assert.equal(url, "http://127.0.0.1:11434/api/chat");
    assert.equal(init?.redirect, "error");
    assert.ok(init?.signal);
    assert.equal(typeof init?.body, "string");
    const body = JSON.parse(String(init?.body));
    assert.equal(body.model, "local-model");
    assert.equal(body.stream, false);
    assert.equal(body.keep_alive, 0);
    assert.deepEqual(body.options, { num_ctx: 16384, num_predict: 2048 });
    assert.match(body.messages[1].content, /PRIVATE/);
    return Response.json({ done: true, message: { role: "assistant", content: "suggestion" } });
  };
  assert.equal(await generateWithOllama("local-model", "task", "PRIVATE", mock), "suggestion");
});

test("Ollama failures, malformed output and empty answers are explicit errors", async () => {
  for (const response of [
    new Response("error", { status: 500 }),
    new Response("not JSON"),
    Response.json({ done: false, message: { role: "assistant", content: "partial" } }),
    Response.json({ done: true, message: { role: "assistant", content: "" } }),
    Response.json({ done: true, message: { role: "user", content: "wrong role" } }),
    new Response("x".repeat(1048577)),
  ]) {
    await assert.rejects(generateWithOllama("local-model", "task", "", async () => response));
  }
});

test("local connection errors propagate without cloud fallback", async () => {
  let cloudCalls = 0;
  await assert.rejects(runTask("Task", "", ports({
    plan: async () => { cloudCalls++; return validPlan; },
    generate: async () => { throw new Error("Ollama unavailable"); },
  })), /Ollama unavailable/);
  assert.equal(cloudCalls, 1);
});
