import type { SlaStatus, WorkOrderStatus } from "@/generated/prisma/client";

type WorkOrderSlaInput = {
  createdAt: Date;
  slaDueAt: Date;
  status: WorkOrderStatus | string;
  completedAt: Date | null;
};

export function calculateSlaStatus(
  workOrder: WorkOrderSlaInput,
  now = new Date(),
): SlaStatus {
  if (workOrder.status === "CANCELED") {
    return "ON_TRACK";
  }

  const comparisonTime =
    workOrder.status === "COMPLETED" && workOrder.completedAt
      ? workOrder.completedAt
      : now;

  if (comparisonTime >= workOrder.slaDueAt) {
    return "BREACHED";
  }

  const totalWindowMs =
    workOrder.slaDueAt.getTime() - workOrder.createdAt.getTime();

  if (totalWindowMs <= 0) {
    return "BREACHED";
  }

  const elapsedMs = comparisonTime.getTime() - workOrder.createdAt.getTime();
  const elapsedRatio = elapsedMs / totalWindowMs;

  return elapsedRatio >= 0.75 ? "AT_RISK" : "ON_TRACK";
}
