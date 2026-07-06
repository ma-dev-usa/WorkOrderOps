import Link from "next/link";
import { createWorkOrder } from "@/app/actions/work-orders";
import { prisma } from "@/lib/prisma";

export default async function NewWorkOrderPage() {
  const [customers, sites, technicians] = await Promise.all([
    prisma.customer.findMany({
      orderBy: { name: "asc" },
    }),
    prisma.site.findMany({
      include: { customer: true },
      orderBy: [{ zone: "asc" }, { city: "asc" }],
    }),
    prisma.technician.findMany({
      include: { user: true },
      orderBy: { zone: "asc" },
    }),
  ]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto max-w-4xl px-6 py-8">
        <Link href="/" className="text-sm text-slate-400 hover:text-slate-100">
          Back to dashboard
        </Link>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-500">
            Dispatch Workflow
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Create Work Order</h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Create a field service job, assign it to a customer site, optionally assign a technician, and set an SLA deadline.
          </p>

          <form action={createWorkOrder} className="mt-8 space-y-5">
            <div>
              <label className="text-sm text-slate-400">Title</label>
              <input
                name="title"
                required
                placeholder="Example: Replace rooftop unit filter"
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              />
            </div>

            <div>
              <label className="text-sm text-slate-400">Description</label>
              <textarea
                name="description"
                required
                rows={4}
                placeholder="Describe the issue, requested work, or operational context."
                className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              />
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label className="text-sm text-slate-400">Customer</label>
                <select
                  name="customerId"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                >
                  <option value="">Select customer</option>
                  {customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-400">Site</label>
                <select
                  name="siteId"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                >
                  <option value="">Select site</option>
                  {sites.map((site) => (
                    <option key={site.id} value={site.id}>
                      {site.customer.name} | {site.city}, {site.state} | {site.zone}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-400">Technician</label>
                <select
                  name="assignedTechnicianId"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                >
                  <option value="">Unassigned</option>
                  {technicians.map((technician) => (
                    <option key={technician.id} value={technician.id}>
                      {technician.user.name} | {technician.zone} | {technician.availabilityStatus}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-400">Priority</label>
                <select
                  name="priority"
                  defaultValue="MEDIUM"
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                >
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>

              <div>
                <label className="text-sm text-slate-400">SLA Hours</label>
                <input
                  name="slaHours"
                  type="number"
                  min="1"
                  defaultValue="24"
                  required
                  className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="rounded-xl border border-slate-700 bg-slate-100 px-5 py-3 text-sm font-medium text-slate-950 hover:bg-white"
            >
              Create Work Order
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
