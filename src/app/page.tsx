import Link from "next/link";
import { prisma } from "@/lib/prisma";

export default async function Home() {
  const [
    totalWorkOrders,
    openWorkOrders,
    breachedWorkOrders,
    atRiskWorkOrders,
    recentWorkOrders,
    parts,
    technicians,
  ] = await Promise.all([
    prisma.workOrder.count(),
    prisma.workOrder.count({
      where: {
        status: {
          notIn: ["COMPLETED", "CANCELED"],
        },
      },
    }),
    prisma.workOrder.count({
      where: {
        slaStatus: "BREACHED",
      },
    }),
    prisma.workOrder.count({
      where: {
        slaStatus: "AT_RISK",
      },
    }),
    prisma.workOrder.findMany({
      take: 8,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        customer: true,
        site: true,
        assignedTechnician: {
          include: {
            user: true,
          },
        },
      },
    }),
    prisma.part.findMany({
      orderBy: {
        quantityOnHand: "asc",
      },
    }),
    prisma.technician.findMany({
      include: {
        user: true,
        workOrders: {
          where: {
            status: {
              notIn: ["COMPLETED", "CANCELED"],
            },
          },
        },
      },
      orderBy: {
        zone: "asc",
      },
    }),
  ]);

  const lowStockParts = parts.filter(
    (part) => part.quantityOnHand <= part.reorderLevel,
  );

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-slate-400">
              WorkOrderOps
            </p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight">
              Field Service Operations Dashboard
            </h1>
            <p className="mt-3 max-w-3xl text-slate-300">
              Dispatch technicians, track work orders, monitor SLA risk, and manage parts inventory from one operational dashboard.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:items-end">
            <Link
              href="/work-orders/new"
              className="rounded-xl border border-slate-700 bg-slate-100 px-5 py-3 text-sm font-medium text-slate-950 hover:bg-white"
            >
              New Work Order
            </Link>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 px-5 py-4 text-sm text-slate-300">
              Demo database: PostgreSQL + Prisma
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="Total Work Orders" value={totalWorkOrders} />
          <MetricCard label="Open Work Orders" value={openWorkOrders} />
          <MetricCard label="At Risk" value={atRiskWorkOrders} />
          <MetricCard label="SLA Breached" value={breachedWorkOrders} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 lg:col-span-2">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Work Orders</h2>
              <span className="text-sm text-slate-400">
                Live from database
              </span>
            </div>

            <div className="mt-4 overflow-hidden rounded-xl border border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-4 py-3">Job</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Technician</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">SLA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {recentWorkOrders.map((workOrder) => (
                    <tr key={workOrder.id} className="bg-slate-950/40">
                      <td className="px-4 py-3">
                        <Link
                          href={`/work-orders/${workOrder.id}`}
                          className="font-medium hover:text-blue-300"
                        >
                          {workOrder.title}
                        </Link>
                        <div className="text-xs text-slate-500">
                          {workOrder.site.city}, {workOrder.site.state}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {workOrder.customer.name}
                      </td>
                      <td className="px-4 py-3 text-slate-300">
                        {workOrder.assignedTechnician?.user.name ?? "Unassigned"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge value={workOrder.status} />
                      </td>
                      <td className="px-4 py-3">
                        <SlaBadge value={workOrder.slaStatus} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
            <h2 className="text-xl font-semibold">Low Stock Parts</h2>
            <div className="mt-4 space-y-3">
              {lowStockParts.length === 0 ? (
                <p className="text-sm text-slate-400">No low-stock parts.</p>
              ) : (
                lowStockParts.map((part) => (
                  <div
                    key={part.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                  >
                    <div className="font-medium">{part.name}</div>
                    <div className="mt-1 text-xs text-slate-500">{part.sku}</div>
                    <div className="mt-3 text-sm text-slate-300">
                      On hand: {part.quantityOnHand} | Reorder: {part.reorderLevel}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
          <h2 className="text-xl font-semibold">Technician Load</h2>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {technicians.map((technician) => (
              <div
                key={technician.id}
                className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{technician.user.name}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {technician.skillLevel} | {technician.zone} Zone
                    </div>
                  </div>
                  <StatusBadge value={technician.availabilityStatus} />
                </div>

                <div className="mt-4 text-sm text-slate-300">
                  Active work orders: {technician.workOrders.length}
                </div>
              </div>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5">
      <div className="text-sm text-slate-400">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
      {value.replaceAll("_", " ")}
    </span>
  );
}

function SlaBadge({ value }: { value: string }) {
  const className =
    value === "BREACHED"
      ? "border-red-800 bg-red-950 text-red-200"
      : value === "AT_RISK"
        ? "border-yellow-800 bg-yellow-950 text-yellow-200"
        : "border-emerald-800 bg-emerald-950 text-emerald-200";

  return (
    <span className={`rounded-full border px-3 py-1 text-xs font-medium ${className}`}>
      {value.replaceAll("_", " ")}
    </span>
  );
}
