"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { WorkOrderStatus } from "@/generated/prisma/client";

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
