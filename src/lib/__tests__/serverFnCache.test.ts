import { describe, it, expect } from "vitest";
import { installServerFnCache, _resetServerFnCacheForTest } from "@/lib/serverFnCache";

const make = () => {
  _resetServerFnCacheForTest();
  let calls = 0;
  const g: any = {
    fetch: async (_i: any, init?: any) => { calls++; return new Response(JSON.stringify({ n: calls, m: init?.method ?? "GET" }), { status: 200 }); },
  };
  installServerFnCache(g);
  return { g, calls: () => calls };
};

describe("serverFnCache", () => {
  it("shares identical concurrent reads and reuses the answer", async () => {
    const { g, calls } = make();
    const rs = await Promise.all([1, 2, 3].map(() => g.fetch("/_serverFn/abc")));
    expect(calls()).toBe(1);
    expect(await Promise.all(rs.map((r: Response) => r.json()))).toEqual([{ n: 1, m: "GET" }, { n: 1, m: "GET" }, { n: 1, m: "GET" }]);
    await g.fetch("/_serverFn/abc");
    expect(calls()).toBe(1);
  });
  it("different reads are not shared", async () => {
    const { g, calls } = make();
    await Promise.all([g.fetch("/_serverFn/a"), g.fetch("/_serverFn/b")]);
    expect(calls()).toBe(2);
  });
  it("a write clears the cache so the next read is fresh", async () => {
    const { g, calls } = make();
    await g.fetch("/_serverFn/abc");
    await g.fetch("/_serverFn/save", { method: "POST" });
    await g.fetch("/_serverFn/abc");
    expect(calls()).toBe(3);
  });
  it("a read that started before a write finished is not reused after it", async () => {
    const { g, calls } = make();
    const slowRead = g.fetch("/_serverFn/abc");
    await g.fetch("/_serverFn/save", { method: "POST" });
    await slowRead;
    await g.fetch("/_serverFn/abc");
    expect(calls()).toBe(3);
  });
  it("leaves non-serverFn requests and aborted-signal requests alone", async () => {
    const { g, calls } = make();
    await g.fetch("/api/x"); await g.fetch("/api/x");
    await g.fetch("/_serverFn/abc", { signal: new AbortController().signal });
    await g.fetch("/_serverFn/abc", { signal: new AbortController().signal });
    expect(calls()).toBe(4);
  });
});
