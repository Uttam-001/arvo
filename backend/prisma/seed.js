import { AgentRole, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const passwordHashPlaceholder = 'demo-session-only-password-login-disabled';

const team = [
  ['Meera Iyer', 'meera.iyer@frontdesk.demo', AgentRole.SUPPORT_LEAD],
  ['Arun Nair', 'arun.nair@frontdesk.demo', AgentRole.SUPPORT_AGENT],
  ['Priya Shah', 'priya.shah@frontdesk.demo', AgentRole.SUPPORT_AGENT],
  ['Neha Kapoor', 'neha.kapoor@frontdesk.demo', AgentRole.SUPPORT_AGENT],
  ['Kavya Reddy', 'kavya.reddy@frontdesk.demo', AgentRole.SUPPORT_AGENT],
  ['Rohan Mehta', 'rohan.mehta@frontdesk.demo', AgentRole.SUPPORT_AGENT],
  ['Ishaan Bose', 'ishaan.bose@frontdesk.demo', AgentRole.SUPPORT_AGENT],
  ['Divya Menon', 'divya.menon@frontdesk.demo', AgentRole.SUPPORT_AGENT],
  ['Farhan Ali', 'farhan.ali@frontdesk.demo', AgentRole.SUPPORT_AGENT],
  ['Anjali Desai', 'anjali.desai@frontdesk.demo', AgentRole.SUPPORT_AGENT]
];

const customers = [
  ['Aarav Malhotra', 'aarav@bluepeak.example', 'BluePeak Labs', '+91 70000 10001'], ['Ira Sen', 'ira@copperleaf.example', 'Copperleaf Studio', '+91 70000 10002'],
  ['Kabir Rao', 'kabir@northwind.example', 'Northwind Retail', '+91 70000 10003'], ['Maya Joseph', 'maya@orbitline.example', 'Orbitline Media', '+91 70000 10004'],
  ['Dev Patel', 'dev@brightpath.example', 'BrightPath Learning', '+91 70000 10005'], ['Tara Kulkarni', 'tara@weaveworks.example', 'Weaveworks Textiles', '+91 70000 10006'],
  ['Samar Gupta', 'samar@fleetnest.example', 'FleetNest Logistics', '+91 70000 10007'], ['Nisha Verma', 'nisha@mapleroot.example', 'MapleRoot Foods', '+91 70000 10008'],
  ['Aditya Pillai', 'aditya@solvex.example', 'Solvex Systems', '+91 70000 10009'], ['Rhea Dutta', 'rhea@greenroom.example', 'Greenroom Events', '+91 70000 10010'],
  ['Vivek Sinha', 'vivek@harborstone.example', 'Harborstone Realty', '+91 70000 10011'], ['Leela Krishnan', 'leela@papertrail.example', 'Papertrail Press', '+91 70000 10012'],
  ['Om Prakash', 'om@juniper.example', 'Juniper Health', '+91 70000 10013'], ['Sana Khan', 'sana@alto.example', 'Alto Design Co.', '+91 70000 10014'],
  ['Kiran Bhat', 'kiran@vertexworks.example', 'VertexWorks', '+91 70000 10015'], ['Ananya Roy', 'ananya@sunfield.example', 'Sunfield Organics', '+91 70000 10016'],
  ['Manav Chawla', 'manav@lattice.example', 'Lattice Finance', '+91 70000 10017'], ['Zoya Mirza', 'zoya@civicbridge.example', 'CivicBridge', '+91 70000 10018'],
  ['Ritesh Jain', 'ritesh@pocketforge.example', 'PocketForge', '+91 70000 10019'], ['Pooja Nambiar', 'pooja@willow.example', 'Willow Hospitality', '+91 70000 10020'],
  ['Amit Ghosh', 'amit@skylark.example', 'Skylark Analytics', '+91 70000 10021'], ['Sia Bansal', 'sia@riverbend.example', 'Riverbend Farms', '+91 70000 10022'],
  ['Naveen Das', 'naveen@oakandink.example', 'Oak & Ink', '+91 70000 10023'], ['Isha Arora', 'isha@cobalt.example', 'Cobalt Energy', '+91 70000 10024'],
  ['Rahul Shetty', 'rahul@monsoon.example', 'Monsoon Mobility', '+91 70000 10025'], ['Meghna Paul', 'meghna@everfield.example', 'Everfield Services', '+91 70000 10026']
];

async function main() {
  for (const [name, email, role] of team) {
    await prisma.agent.upsert({ where: { email }, update: { name, role, isDemo: true, isActive: true }, create: { name, email, role, isDemo: true, isActive: true, passwordHash: passwordHashPlaceholder } });
  }
  for (const [name, email, company, phone] of customers) {
    await prisma.customer.upsert({ where: { email }, update: { name, company, phone }, create: { name, email, company, phone } });
  }
  await prisma.holiday.createMany({ data: [{ holidayDate: new Date('2026-12-25T00:00:00.000Z'), name: 'Christmas Day' }, { holidayDate: new Date('2027-01-01T00:00:00.000Z'), name: 'New Year Day' }], skipDuplicates: true });
  console.log('Seeded 1 Support Lead, 9 Support Agents, 26 customers, and holidays. No tickets were created.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => prisma.$disconnect());
