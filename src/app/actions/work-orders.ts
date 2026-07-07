"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { calculateSlaStatus } from "@/lib/sla";
import { Priority, WorkOrderStatus } from "@/generated/prisma/client";

const validStatuses = new Set<string>([
  "CREATED",
  "ASSIGNED",
  "IN_PROGRESS",
  "WAITING_ON_PARTS",
  "COMPLETED",
  "CANCELED",
]);

export async function updateWorkOrderStatus(formData: FormData) {
  const workOrderId = String(formData.get("workOrderId") ?? "");
  const nextStatus = String(formData.get("status") ?? "");

  if (!workOrderId || !validStatuses.has(nextStatus)) {
    throw new Error("Invalid work order status update.");
  }

  const existing = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
  });

  if (!existing) {
    throw new Error("Work order not found.");
  }

  const now = new Date();
  const status = nextStatus as WorkOrderStatus;
  const completedAt =
    status === "COMPLETED" ? existing.completedAt ?? now : null;
  const slaStatus = calculateSlaStatus(
    {
      ...existing,
      status,
      completedAt,
    },
    now,
  );

  const updated = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status,
      completedAt,
      slaStatus,
    },
  });

  await prisma.$transaction([
    prisma.auditLog.create({
      data: {
        entityType: "WorkOrder",
        entityId: updated.id,
        action: "STATUS_UPDATED",
        oldValue: existing.status,
        newValue: nextStatus,
      },
    }),
    ...(existing.slaStatus !== slaStatus
      ? [
          prisma.auditLog.create({
            data: {
              entityType: "WorkOrder",
              entityId: updated.id,
              action: "SLA_RECALCULATED",
              oldValue: existing.slaStatus,
              newValue: slaStatus,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath("/");
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function addPartToWorkOrder(formData: FormData) {
  const workOrderId = String(formData.get("workOrderId") ?? "");
  const partId = String(formData.get("partId") ?? "");
  const quantityUsed = Number(formData.get("quantityUsed") ?? 0);

  if (!workOrderId || !partId || !Number.isInteger(quantityUsed) || quantityUsed <= 0) {
    throw new Error("Invalid part usage request.");
  }

  const part = await prisma.part.findUnique({
    where: { id: partId },
  });

  if (!part) {
    throw new Error("Part not found.");
  }

  if (part.quantityOnHand < quantityUsed) {
    throw new Error("Insufficient inventory for this part.");
  }

  await prisma.$transaction(async (tx) => {
    await tx.part.update({
      where: { id: partId },
      data: {
        quantityOnHand: {
          decrement: quantityUsed,
        },
      },
    });

    await tx.workOrderPart.create({
      data: {
        workOrderId,
        partId,
        quantityUsed,
      },
    });

    await tx.auditLog.create({
      data: {
        entityType: "WorkOrder",
        entityId: workOrderId,
        action: "PART_USED",
        oldValue: `${part.name}: ${part.quantityOnHand} on hand`,
        newValue: `${quantityUsed} used, ${part.quantityOnHand - quantityUsed} remaining`,
      },
    });
  });

  revalidatePath("/");
  revalidatePath(`/work-orders/${workOrderId}`);
}


const validPriorities = new Set<string>(["LOW", "MEDIUM", "HIGH", "URGENT"]);

export async function createWorkOrder(formData: FormData) {
  const customerId = String(formData.get("customerId") ?? "");
  const siteId = String(formData.get("siteId") ?? "");
  const assignedTechnicianIdRaw = String(formData.get("assignedTechnicianId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const priority = String(formData.get("priority") ?? "MEDIUM");
  const slaHours = Number(formData.get("slaHours") ?? 24);

  if (!customerId || !siteId || !title || !description) {
    throw new Error("Missing required work order fields.");
  }

  if (!validPriorities.has(priority)) {
    throw new Error("Invalid priority.");
  }

  if (!Number.isFinite(slaHours) || slaHours <= 0) {
    throw new Error("Invalid SLA hours.");
  }

  const assignedTechnicianId =
    assignedTechnicianIdRaw === "" ? null : assignedTechnicianIdRaw;

  const now = new Date();
  const status = assignedTechnicianId
    ? WorkOrderStatus.ASSIGNED
    : WorkOrderStatus.CREATED;
  const slaDueAt = new Date(now.getTime() + slaHours * 60 * 60 * 1000);

  const created = await prisma.workOrder.create({
    data: {
      customerId,
      siteId,
      assignedTechnicianId,
      title,
      description,
      priority: priority as Priority,
      status,
      slaDueAt,
      slaStatus: calculateSlaStatus(
        {
          createdAt: now,
          slaDueAt,
          status,
          completedAt: null,
        },
        now,
      ),
    },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "WorkOrder",
      entityId: created.id,
      action: "CREATED_FROM_UI",
      oldValue: null,
      newValue: `${created.title} created with status ${created.status}`,
    },
  });

  revalidatePath("/");
  redirect(`/work-orders/${created.id}`);
}

export async function reassignWorkOrderTechnician(formData: FormData): Promise<void> {
  const workOrderId = String(formData.get("workOrderId") ?? "");
  const assignedTechnicianIdRaw = String(
    formData.get("assignedTechnicianId") ?? "",
  );

  if (!workOrderId) {
    throw new Error("Missing work order ID.");
  }

  const assignedTechnicianId =
    assignedTechnicianIdRaw === "" ? null : assignedTechnicianIdRaw;

  const existing = await prisma.workOrder.findUnique({
    where: {
      id: workOrderId,
    },
    include: {
      assignedTechnician: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error("Work order not found.");
  }

  const nextTechnician = assignedTechnicianId
    ? await prisma.technician.findUnique({
        where: {
          id: assignedTechnicianId,
        },
        include: {
          user: true,
        },
      })
    : null;

  if (assignedTechnicianId && !nextTechnician) {
    throw new Error("Technician not found.");
  }

  if (existing.assignedTechnicianId === assignedTechnicianId) {
    revalidatePath("/");
    revalidatePath(`/work-orders/${workOrderId}`);
    return;
  }

  const nextStatus =
    assignedTechnicianId && existing.status === WorkOrderStatus.CREATED
      ? WorkOrderStatus.ASSIGNED
      : existing.status;

  await prisma.$transaction([
    prisma.workOrder.update({
      where: {
        id: workOrderId,
      },
      data: {
        assignedTechnicianId,
        status: nextStatus,
      },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "WorkOrder",
        entityId: workOrderId,
        action: "TECHNICIAN_REASSIGNED",
        oldValue: existing.assignedTechnician?.user.name ?? "Unassigned",
        newValue: nextTechnician?.user.name ?? "Unassigned",
      },
    }),
    ...(existing.status !== nextStatus
      ? [
          prisma.auditLog.create({
            data: {
              entityType: "WorkOrder",
              entityId: workOrderId,
              action: "STATUS_UPDATED",
              oldValue: existing.status,
              newValue: nextStatus,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath("/");
  revalidatePath(`/work-orders/${workOrderId}`);
}

export async function reassignWorkOrderTechnician(formData: FormData): Promise<void> {
  const workOrderId = String(formData.get("workOrderId") ?? "");
  const assignedTechnicianIdRaw = String(
    formData.get("assignedTechnicianId") ?? "",
  );

  if (!workOrderId) {
    throw new Error("Missing work order ID.");
  }

  const assignedTechnicianId =
    assignedTechnicianIdRaw === "" ? null : assignedTechnicianIdRaw;

  const existing = await prisma.workOrder.findUnique({
    where: {
      id: workOrderId,
    },
    include: {
      assignedTechnician: {
        include: {
          user: true,
        },
      },
    },
  });

  if (!existing) {
    throw new Error("Work order not found.");
  }

  const nextTechnician = assignedTechnicianId
    ? await prisma.technician.findUnique({
        where: {
          id: assignedTechnicianId,
        },
        include: {
          user: true,
        },
      })
    : null;

  if (assignedTechnicianId && !nextTechnician) {
    throw new Error("Technician not found.");
  }

  if (existing.assignedTechnicianId === assignedTechnicianId) {
    revalidatePath("/");
    revalidatePath(`/work-orders/${workOrderId}`);
    return;
  }

  const nextStatus =
    assignedTechnicianId && existing.status === WorkOrderStatus.CREATED
      ? WorkOrderStatus.ASSIGNED
      : existing.status;

  await prisma.$transaction([
    prisma.workOrder.update({
      where: {
        id: workOrderId,
      },
      data: {
        assignedTechnicianId,
        status: nextStatus,
      },
    }),
    prisma.auditLog.create({
      data: {
        entityType: "WorkOrder",
        entityId: workOrderId,
        action: "TECHNICIAN_REASSIGNED",
        oldValue: existing.assignedTechnician?.user.name ?? "Unassigned",
        newValue: nextTechnician?.user.name ?? "Unassigned",
      },
    }),
    ...(existing.status !== nextStatus
      ? [
          prisma.auditLog.create({
            data: {
              entityType: "WorkOrder",
              entityId: workOrderId,
              action: "STATUS_UPDATED",
              oldValue: existing.status,
              newValue: nextStatus,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath("/");
  revalidatePath(`/work-orders/${workOrderId}`);
}
