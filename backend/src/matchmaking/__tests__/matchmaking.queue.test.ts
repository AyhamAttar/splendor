import { InMemoryMatchmakingQueue } from "../matchmaking.queue";

const entry = (key: string, joinedAt = Date.now()) => ({
  key,
  identity: { guestId: key },
  name: key,
  joinedAt,
});

describe("InMemoryMatchmakingQueue", () => {
  it("upserts one entry per key and preserves queue position", () => {
    const q = new InMemoryMatchmakingQueue();
    q.upsert(entry("a", 100));
    q.upsert({ ...entry("a", 999), name: "renamed" });
    expect(q.waiting()).toHaveLength(1);
    expect(q.get("a")?.joinedAt).toBe(100); // position preserved
    expect(q.get("a")?.name).toBe("renamed"); // name refreshed
  });

  it("separates waiting from matched entries", () => {
    const q = new InMemoryMatchmakingQueue();
    q.upsert(entry("a"));
    q.upsert(entry("b"));
    q.setMatched(["a"], "game-1");

    expect(q.waiting().map((e) => e.key)).toEqual(["b"]);
    expect(q.matched().map((e) => e.key)).toEqual(["a"]);
    expect(q.get("a")?.gameId).toBe("game-1");
    expect(q.get("a")?.matchedAt).toEqual(expect.any(Number));
  });

  it("removes entries", () => {
    const q = new InMemoryMatchmakingQueue();
    q.upsert(entry("a"));
    q.remove("a");
    expect(q.get("a")).toBeUndefined();
    expect(q.waiting()).toHaveLength(0);
  });
});
