"use client";

import { Gift } from "lucide-react";
import AICheckout, {
  type CheckoutDetails,
} from "@/components/kokonutui/ai-checkout";
import { StreamPlate, useScript } from "@/components/mdx/stream-plate";

/** What a `prepare_order` tool would return. */
const ORDER: CheckoutDetails = {
  merchant: "Paper & Co",
  item: {
    title: "Linen notebook",
    subtitle: "A5, dot grid",
    unitPrice: 2400,
    quantity: 1,
    maxQuantity: 4,
    icon: <Gift className="size-5" />,
  },
  taxRate: 0.2,
  currency: "EUR",
  cardLast4: "1881",
  delivery: "Arrives Friday",
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export default function AICheckoutStream() {
  const { play, run, key } = useScript([0]);

  // Your server charges the card; a throw puts the order back with its reason.
  const pay = async () => {
    await wait(1400);
    if (run === "error") {
      throw new Error("Your card was declined. Try another card.");
    }
    return "A19C";
  };

  return (
    <StreamPlate
      label="Paid through your own handler. Press Pay."
      play={play}
      run={run}
    >
      <AICheckout
        checkout={ORDER}
        confirmation="Ordered. It ships tomorrow."
        key={key}
        message="This one is in stock. Want it?"
        onPay={pay}
      />
    </StreamPlate>
  );
}
