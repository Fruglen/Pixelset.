function money(cents: number) {
  return `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Online payment is parked (GLE-135): this shows the amount and how to pay,
// and has no form that could record a payment.
export function PayLinkClient({ fixedCents, howToPay }: { fixedCents: number; howToPay: string }) {
  return (
    <div className="card p-6 space-y-4">
      {fixedCents > 0 ? <p className="text-center text-3xl font-display">{money(fixedCents)}</p> : null}
      <p className="text-sm text-center text-neutral-600">Online payment is not enabled yet, and you have not been charged.</p>
      <p className="text-sm text-center text-neutral-600 whitespace-pre-wrap">
        {howToPay ? `How to pay: ${howToPay}` : "Your photographer will arrange payment with you."}
      </p>
    </div>
  );
}
