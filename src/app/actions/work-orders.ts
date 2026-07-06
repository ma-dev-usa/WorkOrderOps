"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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

  const completedAt =
    nextStatus === "COMPLETED" ? new Date() : existing.completedAt;

  const updated = await prisma.workOrder.update({
    where: { id: workOrderId },
    data: {
      status: nextStatus as WorkOrderStatus,
      completedAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      entityType: "WorkOrder",
      entityId: updated.id,
      action: "STATUS_UPDATED",
      oldValue: existing.status,
      newValue: nextStatus,
    },
  });

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

  const created = await prisma.workOrder.create({
    data: {
      customerId,
      siteId,
      assignedTechnicianId,
      title,
      description,
      priority: priority as Priority,
      status: assignedTechnicianId ? WorkOrderStatus.ASSIGNED : WorkOrderStatus.CREATED,
      slaDueAt: new Date(Date.now() + slaHours * 60 * 60 * 1000),
      slaStatus: "ON_TRACK",
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
