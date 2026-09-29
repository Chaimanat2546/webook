import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

describe("agency numeric ID migration", { skip: process.env.RUN_AGENCY_DB_TESTS !== "1" }, () => {
  const container = `webook-agency-id-test-${process.pid}`;

  function sql(source: string) {
    const result = spawnSync(
      "docker",
      ["exec", "-i", container, "psql", "-U", "postgres", "-v", "ON_ERROR_STOP=1", "-At"],
      { input: source, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  }

  before(async () => {
    const run = spawnSync(
      "docker",
      ["run", "--rm", "-d", "--name", container, "-e", "POSTGRES_HOST_AUTH_METHOD=trust", "postgres:17-alpine"],
      { encoding: "utf8" },
    );
    assert.equal(run.status, 0, run.stderr);
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      if (spawnSync("docker", ["exec", container, "pg_isready", "-U", "postgres"]).status === 0) {
        ready = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, "PostgreSQL test container did not become ready");
    sql(`
      create role anon;
      create table public.agents (
        id uuid primary key,
        name text not null,
        video_url text not null,
        is_active boolean not null default true
      );
      create table public.agent_accounts (
        id uuid primary key,
        agent_id uuid not null references public.agents(id) on delete cascade,
        bank_id uuid not null,
        account_number text not null,
        unique(agent_id, bank_id, account_number)
      );
      create index idx_agent_accounts_agent_id on public.agent_accounts(agent_id);
      create table public.bookings (id bigint primary key, agent_id bigint);
      insert into public.agents(id,name,video_url,is_active) values
        ('00000000-0000-4000-8000-000000000001','North Agency','https://example.com/north',true),
        ('00000000-0000-4000-8000-000000000002','South Agency','https://example.com/south',false);
      insert into public.agent_accounts(id,agent_id,bank_id,account_number) values
        ('00000000-0000-4000-8000-000000000011','00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000101','1001'),
        ('00000000-0000-4000-8000-000000000012','00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000102','2002');
      insert into public.bookings(id,agent_id) values (1,99);
    `);
    sql(readFileSync(new URL("../supabase/migrations/20260929090000_agents_numeric_ids.sql", import.meta.url), "utf8"));
  });

  after(() => {
    spawnSync("docker", ["rm", "-f", container], { encoding: "utf8" });
  });

  it("maps every existing account to its original agent using bigint IDs", () => {
    assert.match(
      sql(`
        select a.name, pg_typeof(a.id)::text, pg_typeof(aa.agent_id)::text
        from public.agent_accounts aa
        join public.agents a on a.id = aa.agent_id
        order by a.name;
      `),
      /North Agency\|bigint\|bigint\nSouth Agency\|bigint\|bigint\n/,
    );
  });

  it("keeps existing numeric booking agency values untouched", () => {
    assert.equal(sql("select agent_id from public.bookings where id=1"), "99\n");
  });

  it("allocates new agency IDs above every preserved booking agency value", () => {
    assert.equal(sql("select min(id) > 99 from public.agents"), "t\n");
  });
});
