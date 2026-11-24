import dotenv from 'dotenv';
import { eq, desc } from 'drizzle-orm';
import { getDatabase } from '../db/client.ts';
import { jobSources, syncRuns } from '../db/schema.ts';
import { fetchJobicyJobs } from '../lib/aggregation/jobicy.ts';
dotenv.config({path:['.env.local','.env']});
console.log({DATABASE_URL_present: Boolean(process.env.DATABASE_URL), DIRECT_URL_present: Boolean(process.env.DIRECT_URL)});
const {db,client}=getDatabase();
try {
 console.log(JSON.stringify({sources:await db.select().from(jobSources).where(eq(jobSources.sourceType,'jobicy')), runs:await db.select().from(syncRuns).orderBy(desc(syncRuns.startedAt)).limit(5)},null,2));
 if (!process.argv.includes('--database-only')) {
 const result=await fetchJobicyJobs({fetchImpl:async (input,init)=>{const response=await fetch(input,init);const payload=await response.clone().json();console.log(JSON.stringify({endpoint:String(input),httpStatus:response.status,jobs:payload.jobs?.map((j:Record<string,unknown>)=>({id:j.id,title:j.jobTitle,location:j.jobGeo,industry:j.jobIndustry})),nextCursor:payload.nextCursor}));return response;}});
 console.log(JSON.stringify({fetched:result.fetchedCount,accepted:result.jobs.length}));
 }
} finally {await client.end();}
