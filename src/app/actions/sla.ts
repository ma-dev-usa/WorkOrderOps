"use server";

import { revalidatePath } from "next/cache";
import { WorkOrderStatus } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateSlaStatus } from "@/lib/sla";

const openStatuses = [
  WorkOrderStatus.CREATED,
  WorkOrderStatus.ASSIGNED,
  WorkOrderStatus.IN_PROGRESS,
  WorkOrderStatus.WAITING_ON_PARTS,
];

export async function recalculateSlaStatuses(formData: FormData): Promise<void> {
  void formData;

  const now = new Date();

  const workOrders = await prisma.workOrder.findMany({
    where: {
      status: {
        in: openStatuses,
      },
    },
    select: {
      id: true,
      status: true,
      slaStatus: true,
      createdAt: true,
      slaDueAt: true,
      completedAt: true,
    },
  });

  const changes = workOrders
    .map((workOrder) => {
      const nextSlaStatus = calculateSlaStatus(workOrder, now);

      return {
        workOrder,
        nextSlaStatus,
      };
    })
    .filter(({ workOrder, nextSlaStatus }) => {
      return workOrder.slaStatus !== nextSlaStatus;
    });

  if (changes.length > 0) {
    await prisma.$transaction(
      changes.flatMap(({ workOrder, nextSlaStatus }) => [
        prisma.workOrder.update({
          where: {
            id: workOrder.id,
          },
          data: {
            slaStatus: nextSlaStatus,
          },
        }),
        prisma.auditLog.create({
          data: {
            entityType: "WorkOrder",
            entityId: workOrder.id,
            action: "SLA_RECALCULATED",
            oldValue: workOrder.slaStatus,
            newValue: nextSlaStatus,
          },
        }),
      ]),
    );
  }

  revalidatePath("/");

  for (const { workOrder } of changes) {
    revalidatePath(`/work-orders/${workOrder.id}`);
  }
}
