"use client";

import AIOrderStatus, {
  type DeliveryOrder,
  type OrderStatus,
} from "@/components/kokonutui/ai-order-status";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

const ORDER: DeliveryOrder = {
  merchant: "Noodle Bar",
  orderId: "7310",
  courier: "Ana",
  vehicle: "Blue bike",
  minutes: 8,
  progress: 0.2,
  arriveAt: "7:42 pm",
};

/** Tracking updates as a delivery API would send them. */
const UPDATES: { status: OrderStatus; order: DeliveryOrder }[] = [
  [8, 0.2],
  [7, 0.31],
  [6, 0.4],
  [6, 0.47],
  [4, 0.6],
  [3, 0.72],
  [2, 0.83],
  [1, 0.94],
].map(([minutes, progress]) => ({
  status: "on-the-way",
  order: { ...ORDER, minutes, progress },
}));

const FRAMES = [
  ...UPDATES,
  {
    status: "delivered" as const,
    order: { ...ORDER, minutes: 0, progress: 1 },
  },
];

export default function AIOrderStatusStream() {
  const { frame, play, run, key } = useScript(FRAMES, 900);

  return (
    <StreamPlate
      label="Driven by tracking updates"
      play={play}
      run={run}
      withError={false}
    >
      <AIOrderStatus
        delivered="Delivered. Ana left it at the door."
        key={key}
        order={frame.order}
        status={frame.status}
      />
    </StreamPlate>
  );
}
