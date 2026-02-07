import { Card, CardContent } from "@/components/ui";

const paymentMethods = [
  { name: "Venmo", color: "#3D95CE" },
  { name: "Cash App", color: "#00D632" },
  { name: "Zelle", color: "#6D1ED4" },
  { name: "Apple Pay", color: "#FFFFFF" },
];

export function PaymentSection() {
  return (
    <section className="relative py-16 px-4">
      <div className="max-w-lg mx-auto">
        <Card className="glass-card">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold text-white mb-2">
              Settle Up Instantly
            </h2>
            <p className="text-white/60 text-sm mb-6">
              When the round ends, Press calculates who owes who.
              <br />
              Pay or get paid with one tap.
            </p>

            {/* Payment method badges */}
            <div className="flex flex-wrap justify-center gap-3">
              {paymentMethods.map((method) => (
                <div
                  key={method.name}
                  className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10"
                >
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: method.color }}
                  />
                  <span className="text-sm font-medium text-white">
                    {method.name}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}
