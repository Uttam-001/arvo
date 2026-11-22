import { AgentRole } from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';

const passwordHashPlaceholder = 'demo-session-only-password-login-disabled';

// Previous fixture addresses identify records already deployed before the refresh.
const team = [
  ['meera.iyer@frontdesk.demo','Nandita Rao','nandita.rao@frontdesk.example'],
  ['arun.nair@frontdesk.demo','Akhil Suresh','akhil.suresh@frontdesk.example'],
  ['priya.shah@frontdesk.demo','Ritu Banerjee','ritu.banerjee@frontdesk.example'],
  ['neha.kapoor@frontdesk.demo','Sanjana Kurup','sanjana.kurup@frontdesk.example'],
  ['kavya.reddy@frontdesk.demo','Malavika Nambiar','malavika.nambiar@frontdesk.example'],
  ['rohan.mehta@frontdesk.demo','Kunal Verma','kunal.verma@frontdesk.example'],
  ['ishaan.bose@frontdesk.demo','Ayaan Mathew','ayaan.mathew@frontdesk.example'],
  ['divya.menon@frontdesk.demo','Diya Krishnan','diya.krishnan@frontdesk.example'],
  ['farhan.ali@frontdesk.demo','Sameer Thomas','sameer.thomas@frontdesk.example'],
  ['anjali.desai@frontdesk.demo','Nila Prakash','nila.prakash@frontdesk.example'],
];

const customers = [
  ['aarav@bluepeak.example','Mira Collins','mira.collins@customers.frontdesk.example','Aster Point','+1 202-555-0101'],
  ['ira@copperleaf.example','Jules Reyes','jules.reyes@customers.frontdesk.example','Birchline Studio','+1 202-555-0102'],
  ['kabir@northwind.example','Nora Bennett','nora.bennett@customers.frontdesk.example','Crestwood Retail','+1 202-555-0103'],
  ['maya@orbitline.example','Kai Morgan','kai.morgan@customers.frontdesk.example','Delta Frame Media','+1 202-555-0104'],
  ['dev@brightpath.example','Avery Quinn','avery.quinn@customers.frontdesk.example','Elmbridge Learning','+1 202-555-0105'],
  ['tara@weaveworks.example','Drew Palmer','drew.palmer@customers.frontdesk.example','Field & Loom','+1 202-555-0106'],
  ['samar@fleetnest.example','Remy Torres','remy.torres@customers.frontdesk.example','Grove Transit','+1 202-555-0107'],
  ['nisha@mapleroot.example','Sage Brooks','sage.brooks@customers.frontdesk.example','Hearthside Foods','+1 202-555-0108'],
  ['aditya@solvex.example','Ellis Reed','ellis.reed@customers.frontdesk.example','Inkwell Technology','+1 202-555-0109'],
  ['rhea@greenroom.example','Zara Ellis','zara.ellis@customers.frontdesk.example','Juniper Events','+1 202-555-0110'],
  ['vivek@harborstone.example','Micah Stone','micah.stone@customers.frontdesk.example','Keystone Stays','+1 202-555-0111'],
  ['leela@papertrail.example','Tess Rivera','tess.rivera@customers.frontdesk.example','Lantern Press','+1 202-555-0112'],
  ['om@juniper.example','Noel Hayes','noel.hayes@customers.frontdesk.example','Meadow Health','+1 202-555-0113'],
  ['sana@alto.example','Casey Park','casey.park@customers.frontdesk.example','Nook Design','+1 202-555-0114'],
  ['kiran@vertexworks.example','Sasha Bell','sasha.bell@customers.frontdesk.example','Opal Works','+1 202-555-0115'],
  ['ananya@sunfield.example','Rory Baker','rory.baker@customers.frontdesk.example','Pinecrest Organics','+1 202-555-0116'],
  ['manav@lattice.example','Jamie Vale','jamie.vale@customers.frontdesk.example','Quarry Finance','+1 202-555-0117'],
  ['zoya@civicbridge.example','Robin Nash','robin.nash@customers.frontdesk.example','Ridgeway Civic','+1 202-555-0118'],
  ['ritesh@pocketforge.example','Morgan Price','morgan.price@customers.frontdesk.example','Silverleaf Supply','+1 202-555-0119'],
  ['pooja@willow.example','Taylor Snow','taylor.snow@customers.frontdesk.example','Timberline Hospitality','+1 202-555-0120'],
  ['amit@skylark.example','Skyler Lane','skyler.lane@customers.frontdesk.example','Umber Analytics','+1 202-555-0121'],
  ['sia@riverbend.example','Parker Gray','parker.gray@customers.frontdesk.example','Vale Farms','+1 202-555-0122'],
  ['naveen@oakandink.example','Blair Fox','blair.fox@customers.frontdesk.example','Wren & Clay','+1 202-555-0123'],
  ['isha@cobalt.example','Riley Wells','riley.wells@customers.frontdesk.example','Yarrow Energy','+1 202-555-0124'],
  ['rahul@monsoon.example','Jordan Frost','jordan.frost@customers.frontdesk.example','Zephyr Mobility','+1 202-555-0125'],
  ['meghna@everfield.example','Devon Cole','devon.cole@customers.frontdesk.example','Alderfield Services','+1 202-555-0126'],
];

async function main() {
  for (const [index, [previousEmail, name, email]] of team.entries()) {
    const role = index === 0 ? AgentRole.SUPPORT_LEAD : AgentRole.SUPPORT_AGENT;
    const profile = { name, email, role, isDemo: true, isActive: true };
    const updated = await prisma.agent.updateMany({ where: { email: previousEmail, isDemo: true }, data: profile });
    if (!updated.count) {
      await prisma.agent.upsert({ where: { email }, update: profile, create: { ...profile, passwordHash: passwordHashPlaceholder } });
    }
  }

  for (const [previousEmail, name, email, company, phone] of customers) {
    const profile = { name, email, company, phone };
    const updated = await prisma.customer.updateMany({ where: { email: previousEmail }, data: profile });
    if (!updated.count) {
      await prisma.customer.upsert({ where: { email }, update: profile, create: profile });
    }
  }

  await prisma.holiday.createMany({ data: [{ holidayDate: new Date('2026-12-25T00:00:00.000Z'), name: 'Christmas Day' }, { holidayDate: new Date('2027-01-01T00:00:00.000Z'), name: 'New Year Day' }], skipDuplicates: true });
  console.log('Seeded 1 Support Lead, 9 Support Agents, 26 customers, and holidays. No tickets were created.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
