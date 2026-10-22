import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "./route.ts";
test("growth reports require existing admin authorization and do not manufacture zero baselines",async()=>{
  const old=process.env.ADMIN_SECRET, flag=process.env.GROWTH_ANALYTICS_ENABLED;
  process.env.ADMIN_SECRET="test-only";delete process.env.GROWTH_ANALYTICS_ENABLED;
  try {
    assert.equal((await GET(new Request("http://localhost/api/admin/growth"))).status,401);
    const res=await GET(new Request("http://localhost/api/admin/growth",{headers:{"x-admin-secret":"test-only"}}));
    assert.equal(res.headers.get("cache-control"),"private, no-store");assert.equal((await res.json()).available,false);
  }finally {if(old===undefined)delete process.env.ADMIN_SECRET;else process.env.ADMIN_SECRET=old;if(flag===undefined)delete process.env.GROWTH_ANALYTICS_ENABLED;else process.env.GROWTH_ANALYTICS_ENABLED=flag;}
});
