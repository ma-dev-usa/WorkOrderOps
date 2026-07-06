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
