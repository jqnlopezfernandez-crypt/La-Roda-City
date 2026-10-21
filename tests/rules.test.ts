import { describe, expect, it } from "vitest";
import { RULES, SKIP_VOTE, assignRoles, checkWinner, seededRandom, tallyVotes, teamOf, type Role } from "../shared/game/rules";

const ids = (n: number) => Array.from({ length: n }, (_, i) => `p${i}`);

describe("reparto de roles", () => {
  it("rechaza partidas con menos del mínimo de jugadores", () => {
    expect(() => assignRoles(ids(RULES.minPlayers - 1))).toThrow();
  });

  it.each([4, 5, 6, 7, 10, 12])("con %i jugadores el número de impostores es correcto", (n) => {
    for (let seed = 1; seed <= 50; seed++) {
      const roles = [...assignRoles(ids(n), seededRandom(seed)).values()];
      const imp = roles.filter((r) => teamOf(r) === "impostores");
      expect(imp.length).toBe(n >= 7 ? 2 : 1);
      expect(roles.filter((r) => r === "vilchez").length).toBe(1);
      if (n >= 7) expect(new Set(imp)).toEqual(new Set<Role>(["sapo", "gitano"]));
    }
  });

  it("los roles se reparten al azar (todos pueden ser impostor)", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++)
      for (const [id, r] of assignRoles(ids(5), seededRandom(seed))) if (teamOf(r) === "impostores") seen.add(id);
    expect(seen.size).toBe(5);
  });
});

describe("condiciones de victoria", () => {
  const P = (id: string, role: Role, alive = true) => ({ id, role, alive });
  it("ganan los vecinos si no queda impostor vivo", () => {
    expect(checkWinner([P("a", "sapo", false), P("b", "roeno"), P("c", "roeno")])?.winner).toBe("tripulacion");
  });
  it("ganan los impostores al igualar a los vecinos", () => {
    expect(checkWinner([P("a", "sapo"), P("b", "roeno"), P("c", "roeno", false)])?.winner).toBe("impostores");
  });
  it("nadie gana mientras haya más vecinos que impostores", () => {
    expect(checkWinner([P("a", "gitano"), P("b", "roeno"), P("c", "vilchez")])).toBeNull();
  });
  it("ganan los vecinos al completar las misiones", () => {
    expect(checkWinner([P("a", "sapo"), P("b", "roeno"), P("c", "roeno")], 10, 10)?.winner).toBe("tripulacion");
  });
});

describe("votaciones", () => {
  const alive = new Set(["a", "b", "c", "d"]);
  it("expulsa al más votado con mayoría estricta", () => {
    const v = new Map([["a", "c"], ["b", "c"], ["c", "a"], ["d", SKIP_VOTE]]);
    expect(tallyVotes(v, alive).ejected).toBe("c");
  });
  it("empate: nadie es expulsado", () => {
    const v = new Map([["a", "c"], ["b", "c"], ["c", "a"], ["d", "a"]]);
    expect(tallyVotes(v, alive).ejected).toBeNull();
  });
  it("si gana 'saltar', nadie es expulsado", () => {
    const v = new Map([["a", SKIP_VOTE], ["b", SKIP_VOTE], ["c", "a"]]);
    expect(tallyVotes(v, alive).ejected).toBeNull();
  });
  it("los votos de muertos o hacia muertos no cuentan", () => {
    const v = new Map([["a", "z"], ["z", "b"], ["c", "b"]]);
    const r = tallyVotes(v, alive);
    expect(r.counts).toEqual({ b: 1 });
    expect(r.ejected).toBe("b");
  });
});
