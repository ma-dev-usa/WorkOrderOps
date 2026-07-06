import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  Priority,
  TechnicianAvailability,
  UserRole,
  WorkOrderStatus,
  SlaStatus,
} from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const prisma = new PrismaClient({ adapter });

function addHours(date: Date, hours: number) {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

function subHours(date: Date, hours: number) {
  return new Date(date.getTime() - hours * 60 * 60 * 1000);
}

async function main() {
  await prisma.auditLog.deleteMany();
  await prisma.workOrderPart.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.part.deleteMany();
  await prisma.technician.deleteMany();
  await prisma.site.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.user.deleteMany();

  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@workorderops.local",
      role: UserRole.ADMIN,
    },
  });

  const dispatcher = await prisma.user.create({
    data: {
      name: "Dispatcher User",
      email: "dispatcher@workorderops.local",
      role: UserRole.DISPATCHER,
    },
  });

  const techUsers = await Promise.all([
    prisma.user.create({
      data: {
        name: "Sam Rivera",
        email: "sam@workorderops.local",
        role: UserRole.TECHNICIAN,
      },
    }),
    prisma.user.create({
      data: {
        name: "Jordan Lee",
        email: "jordan@workorderops.local",
        role: UserRole.TECHNICIAN,
      },
    }),
    prisma.user.create({
      data: {
        name: "Taylor Kim",
        email: "taylor@workorderops.local",
        role: UserRole.TECHNICIAN,
      },
    }),
  ]);

  const technicians = await Promise.all([
    prisma.technician.create({
      data: {
        userId: techUsers[0].id,
        skillLevel: "Senior",
        zone: "North",
        availabilityStatus: TechnicianAvailability.AVAILABLE,
      },
    }),
    prisma.technician.create({
      data: {
        userId: techUsers[1].id,
        skillLevel: "Intermediate",
        zone: "East",
        availabilityStatus: TechnicianAvailability.BUSY,
      },
    }),
    prisma.technician.create({
      data: {
        userId: techUsers[2].id,
        skillLevel: "Junior",
        zone: "West",
        availabilityStatus: TechnicianAvailability.AVAILABLE,
      },
    }),
  ]);

  const customers = await Promise.all([
    prisma.customer.create({
      data: {
        name: "Cascade Property Group",
        contactName: "Morgan Ellis",
        phone: "503-555-0101",
        email: "operations@cascade.local",
      },
    }),
    prisma.customer.create({
      data: {
        name: "Northline Facilities",
        contactName: "Casey Patel",
        phone: "503-555-0102",
        email: "dispatch@northline.local",
      },
    }),
    prisma.customer.create({
      data: {
        name: "Willamette Industrial Services",
        contactName: "Riley Brooks",
        phone: "503-555-0103",
        email: "maintenance@willamette.local",
      },
    }),
  ]);

  const sites = await Promise.all([
    prisma.site.create({
      data: {
        customerId: customers[0].id,
        address: "1200 NW Front Ave",
        city: "Portland",
        state: "OR",
        zone: "North",
      },
    }),
    prisma.site.create({
      data: {
        customerId: customers[1].id,
        address: "455 SE Industrial Way",
        city: "Portland",
        state: "OR",
        zone: "East",
      },
    }),
    prisma.site.create({
      data: {
        customerId: customers[2].id,
        address: "88 SW Commerce Dr",
        city: "Beaverton",
        state: "OR",
        zone: "West",
      },
    }),
  ]);

  await prisma.part.createMany({
    data: [
      {
        sku: "FILTER-16X25",
        name: "16x25 Air Filter",
        quantityOnHand: 18,
        reorderLevel: 10,
        unitCostCents: 1299,
      },
      {
        sku: "BELT-A42",
        name: "A42 Drive Belt",
        quantityOnHand: 4,
        reorderLevel: 8,
        unitCostCents: 1899,
      },
      {
        sku: "FUSE-20A",
        name: "20A Fuse",
        quantityOnHand: 35,
        reorderLevel: 12,
        unitCostCents: 399,
      },
      {
        sku: "THERMO-WIFI",
        name: "Wi-Fi Thermostat",
        quantityOnHand: 6,
        reorderLevel: 5,
        unitCostCents: 7999,
      },
      {
        sku: "VALVE-CTRL",
        name: "Control Valve",
        quantityOnHand: 2,
        reorderLevel: 4,
        unitCostCents: 5499,
      },
    ],
  });

  const now = new Date();

  const workOrders = [
    {
      customerId: customers[0].id,
      siteId: sites[0].id,
      assignedTechnicianId: technicians[0].id,
      title: "Replace rooftop unit filter",
      description: "Customer reported reduced airflow on the second floor.",
      priority: Priority.MEDIUM,
      status: WorkOrderStatus.ASSIGNED,
      slaDueAt: addHours(now, 8),
      slaStatus: SlaStatus.ON_TRACK,
    },
    {
      customerId: customers[1].id,
      siteId: sites[1].id,
      assignedTechnicianId: technicians[1].id,
      title: "Investigate conveyor motor fault",
      description: "Line 2 intermittently stops during startup.",
      priority: Priority.HIGH,
      status: WorkOrderStatus.IN_PROGRESS,
      slaDueAt: addHours(now, 3),
      slaStatus: SlaStatus.AT_RISK,
    },
    {
      customerId: customers[2].id,
      siteId: sites[2].id,
      assignedTechnicianId: null,
      title: "Control valve replacement",
      description: "Preventive maintenance flagged valve degradation.",
      priority: Priority.URGENT,
      status: WorkOrderStatus.CREATED,
      slaDueAt: subHours(now, 2),
      slaStatus: SlaStatus.BREACHED,
    },
    {
      customerId: customers[0].id,
      siteId: sites[0].id,
      assignedTechnicianId: technicians[2].id,
      title: "Install Wi-Fi thermostat",
      description: "Upgrade requested for tenant suite.",
      priority: Priority.LOW,
      status: WorkOrderStatus.WAITING_ON_PARTS,
      slaDueAt: addHours(now, 24),
      slaStatus: SlaStatus.ON_TRACK,
    },
  ];

  for (const workOrder of workOrders) {
    const created = await prisma.workOrder.create({ data: workOrder });

    await prisma.auditLog.create({
      data: {
        entityType: "WorkOrder",
        entityId: created.id,
        action: "SEEDED",
        newValue: `${created.title} created with status ${created.status}`,
        userId: dispatcher.id,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      entityType: "System",
      entityId: "seed",
      action: "DATABASE_SEEDED",
      newValue: "Demo data created for WorkOrderOps",
      userId: admin.id,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
