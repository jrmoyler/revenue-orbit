// The monthly plan: target, offers and the four-week playbook.
// Shared by the dashboard (index.html), the REST API and the MCP server.
// Edit prices, quantities or tasks here and every surface picks it up.

export const TARGET = 21100;      // monthly revenue target
// Monthly bills are private. They are not in this file because the browser downloads it;
// the server reads them from ORBIT_BILLS instead (see lib/orbit.js).
export const PLAN_START = "2026-11"; // first tracked month
export const TIMEZONE = "America/New_York";

export const OFFERS = [
  {id:"web", name:"AI Website Build", short:"Websites", price:2500, qty:2, color:0xf0a53a,
   pitch:"A full business site with checkout and a lead CRM, live on Vercel in 10 days.",
   proof:"Pr3ss3d & Pr3tty storefront (35 products, Stripe, Sheets CRM), Hybrid Living and Glyph Forge sites.",
   buyer:"Columbus boutiques, salons, contractors and restaurants with dated or missing sites.",
   moves:["Screen-record a 90-second build walkthrough","Audit 10 local sites and send each a one-page fix list","Bundle with an ad pack for $3,000"]},
  {id:"land", name:"Landing Page Sprint", short:"Landing", price:900, qty:2, color:0xe8c46a,
   pitch:"One high-converting page with booking or payment, shipped in 72 hours.",
   proof:"67 projects deployed on Vercel; repeatable page kit.",
   buyer:"Coaches, event hosts, realtors and new product launches.",
   moves:["Offer a 72-hour turnaround guarantee","Post one before/after teardown per week","Upsell to the full site within 30 days"]},
  {id:"ads", name:"AI Video Ad Pack", short:"Ad packs", price:750, qty:4, color:0xe4677a,
   pitch:"Three 15-second spots plus static creative, built style-first so every ad shares one look.",
   proof:"EnerGenius storm-response campaign: static creative and a composited 15-second spot.",
   buyer:"Local service businesses already spending on Meta or TikTok.",
   moves:["Make a free sample spot for one target business","Run the four-step style → image → video → variations flow","Offer a $750/mo retainer after delivery"]},
  {id:"voice", name:"AI Voice Agent Setup", short:"Voice", price:2000, qty:1, color:0x52cdb8,
   pitch:"A phone agent that answers, books and qualifies leads around the clock.",
   proof:"Google-certified voice agent developer.",
   buyer:"Clinics, HVAC and plumbing shops, salons and law offices that miss calls.",
   moves:["Build a live demo line callers can try","Show missed-call math: 10 missed calls × average ticket","Add a $250/mo support plan"]},
  {id:"auto", name:"Automation & CRM Setup", short:"Automation", price:1200, qty:2, color:0x6fa8ff,
   pitch:"Lead capture, follow-ups and reporting wired together so nothing slips.",
   proof:"Sheets CRM automation for an e-commerce launch; 101-page assistant operating guide from live Airtable and Vercel data.",
   buyer:"Owner-operators running the business from their inbox and a notebook.",
   moves:["Map one prospect's lead flow on a free call","Template the build so delivery takes two days","Charge setup plus optional monthly upkeep"]},
  {id:"consult", name:"AI Strategy Session", short:"Consulting", price:250, qty:6, color:0xb592ff,
   pitch:"A 90-minute working session that leaves the client with a tool stack and a 30-day plan.",
   proof:"Daily AI use since 2019; LinkedIn analytics audit; options-trading and Wharton digital-asset background.",
   buyer:"Founders, managers and professionals who know they are behind on AI.",
   moves:["Use sessions as the entry offer for bigger builds","Credit the $250 toward any build booked within 14 days","Ask every session for one referral"]},
  {id:"teach", name:"AI Skills Cohort", short:"Teaching", price:300, qty:6, color:0x9be37a,
   pitch:"A four-session live cohort: prompting, content, automation and a capstone build.",
   proof:"Montessori AI summer camp curriculum (4 themed weeks); Forge Learning Studio app.",
   buyer:"Career switchers, small-business owners, parents and teens with a guardian.",
   moves:["Run a free 45-minute workshop to fill seats","Cap at 6 seats for attention","Record sessions for a later self-paced course"]},
  {id:"digital", name:"Prompt Playbooks", short:"Digital", price:47, qty:30, color:0xd9d4c7,
   pitch:"Downloadable playbooks that sell while you build.",
   proof:"Gemini AI stack playbook: 3 volumes, 1,000 prompts.",
   buyer:"Your content audience and every workshop attendee.",
   moves:["Put the playbook behind a checkout link","Pin it to every post and workshop slide","Bundle 3 volumes at $97"]},
  {id:"3d", name:"Interactive 3D Experience", short:"3D web", price:2200, qty:1, color:0xff8a4c,
   pitch:"A browser-based 3D brand world, mini-game or product viewer that people share.",
   proof:"Crownfall, Zukan Arena and Collective Strike 3D built in Three.js; Ability Matrix VFX library.",
   buyer:"Venues, event brands, schools and product launches that want to stand out.",
   moves:["Turn one existing game scene into a branded demo","Pitch it for a launch, event or holiday campaign","Reuse your preset libraries to keep build time low"]}
];

export const WEEKS = [
  {n:1, days:[1,7], title:"Build the storefront", tasks:[
    ["w1a","Publish a one-page offer menu with all nine services and a booking link","all"],
    ["w1b","Record three demos: site build, ad pack, voice agent","web · ads · voice"],
    ["w1c","List 60 Columbus small businesses with weak sites or no ads","pipeline"],
    ["w1d","Put the prompt playbook behind a $47 checkout","digital"],
    ["w1e","Post five weekday LinkedIn posts with a before/after","content"]]},
  {n:2, days:[8,14], title:"Fill the pipeline", tasks:[
    ["w2a","Send 20 personal outreach messages each weekday (100 total)","pipeline"],
    ["w2b","Book 8 discovery calls","pipeline"],
    ["w2c","Host a free 45-minute AI for Small Business workshop","teach · consult"],
    ["w2d","Send 3 proposals for the site + ad pack bundle","web · ads"]]},
  {n:3, days:[15,21], title:"Close and build", tasks:[
    ["w3a","Close 2 website builds and 1 voice agent with 50% deposits","web · voice"],
    ["w3b","Deliver the first 2 ad packs within 72 hours of kickoff","ads"],
    ["w3c","Fill the 6-seat AI Skills Cohort","teach"],
    ["w3d","Pitch one 3D brand experience to a venue, school or event","3d"]]},
  {n:4, days:[22,28], title:"Deliver and upsell", tasks:[
    ["w4a","Ship site builds on Vercel and collect final payments","web · land"],
    ["w4b","Offer every client a monthly ad or support retainer","ads · voice · auto"],
    ["w4c","Collect 3 testimonials and post them","content"],
    ["w4d","Run the cohort sessions","teach"]]},
  {n:5, days:[29,31], title:"Close the books", tasks:[
    ["w5a","Chase open invoices (Cash App, Zelle, Apple Pay, check)","cash"],
    ["w5b","Review which offers sold and adjust next month's mix","review"],
    ["w5c","Book 5 calls for the first week of next month","pipeline"]]}
];

export const ALL_TASKS = WEEKS.flatMap(w => w.tasks.map(t => t[0]));
export const PLAN_TOTAL = OFFERS.reduce((s, o) => s + o.price * o.qty, 0);
