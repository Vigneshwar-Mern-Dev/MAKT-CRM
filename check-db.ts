import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  console.log("=== Lead Integrations in Database ===");
  const integrations = await prisma.leadIntegration.findMany();
  console.log(JSON.stringify(integrations, null, 2));

  console.log("\n=== Website Leads Count ===");
  const websiteCount = await prisma.websiteLead.count();
  console.log("Website Leads count:", websiteCount);

  console.log("\n=== Instagram Leads Count ===");
  const instagramCount = await prisma.instagramLead.count();
  console.log("Instagram Leads count:", instagramCount);

  console.log("\n=== Website Leads List ===");
  const websiteLeads = await prisma.websiteLead.findMany({
    select: { id: true, atmId: true, name: true, createdAt: true }
  });
  console.log(JSON.stringify(websiteLeads, null, 2));
}

main()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
