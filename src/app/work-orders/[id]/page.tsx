import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateWorkOrderStatus } from "@/app/actions/work-orders";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

const statusOptions = [
  "CREATED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_ON_PARTS",
  "COMPLETED",
  "CANCELED",
];

export default async function WorkOrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  const workOrder = await prisma.workOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      site: true,
      assignedTechnician: {
        include: {
          user: true,
        },
      },
      partsUsed: {
        include: {
          part: true,
        },
      },
    },
  });

  if (!workOrder) {
    notFound();
  }

  const auditLogs = await prisma.auditLog.findMany({
    where: {
      entityType: "WorkOrder",
      entityId: workOrder.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-5xl px-6 py-8">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-100">
          Back to dashboard
        </Link>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
                Work Order
              </p>
              <h1 className="mt-2 text-3xl font-semibold">
                {workOrder.title}
              </h1>
              <p className="mt-3 max-w-3xl text-slate-300">
                {workOrder.description}
              </p>
            </div>

            <div className="flex flex-col gap-2 text-sm">
              <Badge label={workOrder.status.replaceAll("_", " ")} />
              <SlaBadge value={workOrder.slaStatus} />
            </div>
          </div>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <InfoCard label="Customer" value={workOrder.customer.name} />
            <InfoCard
              label="Technician"
              value={workOrder.assignedTechnician?.user.name ?? "Unassigned"}
            />
            <InfoCard
              label="Site"
              value={`${workOrder.site.address}, ${workOrder.site.city}, ${workOrder.site.state}`}
            />
            <InfoCard
              label="SLA Due"
              value={workOrder.slaDueAt.toLocaleString()}
            />
            <InfoCard label="Priority" value={workOrder.priority} />
            <InfoCard
              label="Completed At"
              value={workOrder.completedAt?.toLocaleString() ?? "Not completed"}
            />
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <h2 className="text-xl font-semibold">Update Status</h2>

          <div className="mt-4 flex flex-wrap gap-3">
            {statusOptions.map((status) => (
              <form key={status} action={updateWorkOrderStatus}>
                <input type="hidden" name="workOrderId" value={workOrder.id} />
                <input type="hidden" name="status" value={status} />
                <button
                  type="submit"
                  className="rounded-full border border-slate-700 bg-slate-950 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
                >
                  {status.replaceAll("_", " ")}
                </button>
              </form>
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Parts Used</h2>

            <div className="mt-4 space-y-3">
              {workOrder.partsUsed.length === 0 ? (
                <p className="text-sm text-slate-400">
                  No parts have been attached to this work order yet.
                </p>
              ) : (
                workOrder.partsUsed.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                  >
                    <div className="font-medium">{item.part.name}</div>
                    <div className="text-sm text-slate-400">
                      Quantity used: {item.quantityUsed}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
            <h2 className="text-xl font-semibold">Audit Log</h2>

            <div className="mt-4 space-y-3">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 p-4"
                >
                  <div className="font-medium">{log.action}</div>
                  <div className="mt-1 text-sm text-slate-400">
                    {log.oldValue ?? "NULL"} → {log.newValue ?? "NULL"}
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {log.createdAt.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

function Badge({ label }: { label: string }) {
  return (
    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-medium text-slate-200">
      {label}
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
