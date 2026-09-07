import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { NetworkSwitcher } from "@/components/NetworkSwitcher";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useRefreshAll } from "@/hooks/useLitdex";
import { useWallet } from "@/hooks/useWallet";
import { API_BASE, formatPoints, parseWalletError, pointsContract } from "@/lib/litdex";

type ClaimStep = "idle" | "burning" | "signing" | "confirming";

export function ClaimModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { address, getSigner, correctNetwork } = useWallet();
  const refreshAll = useRefreshAll();
  const [amount, setAmount] = useState("");
  const [step, setStep] = useState<ClaimStep>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount("");
      setStep("idle");
      setError(null);
    }
  }, [open]);

  const litvm = useQuery({
    queryKey: ["litvmBalance", address],
    enabled: open && !!address,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/points/balance/${address}`);
      if (!res.ok) throw new Error("Could not load LitVM balance");
      return (await res.json()) as { litvmAvailable: string; baseBalance: string };
    },
  });

  const available = litvm.data ? BigInt(litvm.data.litvmAvailable || "0") : null;
  let amountValid = false;
  try {
    if (amount.trim() !== "" && /^\d+$/.test(amount.trim())) {
      const a = BigInt(amount.trim());
      amountValid = a > 0n && (available === null || a <= available);
    }
  } catch {
    amountValid = false;
  }

  const busy = step !== "idle";

  async function handleConvert() {
    if (!address || !amountValid) return;
    setError(null);
    setStep("burning");
    try {
      const res = await fetch(`${API_BASE}/points/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, amount: amount.trim() }),
      });
      const body = (await res.json().catch(() => null)) as
        | { totalEarned: string; expiry: string; signature: string; error?: string; message?: string }
        | null;
      if (!res.ok) {
        setError(body?.error || body?.message || "Claim request failed. Try again.");
        setStep("idle");
        return;
      }
      if (!body) throw new Error("bad response");

      setStep("signing");
      const signer = await getSigner();
      const contract = pointsContract(signer);
      const tx = await contract.claim(body.totalEarned, body.expiry, body.signature);
      setStep("confirming");
      await tx.wait();
      await refreshAll();
      toast.success("Points claimed on Base");
      onOpenChange(false);
    } catch (err) {
      setError(parseWalletError(err, "Claim failed, try again."));
    } finally {
      setStep("idle");
    }
  }

  const stepLabel =
    step === "burning"
      ? "Burning on LitVM"
      : step === "signing"
        ? "Confirm in wallet"
        : step === "confirming"
          ? "Confirming on Base"
          : null;

  return (
    <Dialog open={open} onOpenChange={(v) => (busy ? null : onOpenChange(v))}>
      <DialogContent className="rounded-[2rem] border-white/30 bg-[#0038FF]/85 text-white shadow-2xl backdrop-blur-xl">
        <DialogHeader>
          <DialogTitle className="btn-text text-[#CCFF00]">
            Claim from LitVM
          </DialogTitle>
          <DialogDescription className="btn-text text-white/70">
            Burn points on LitVM and mint them as spendable points on Base Mainnet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/25 bg-white/10 p-3">
            {litvm.isLoading && <span className="btn-text text-white/60">Loading LitVM balance…</span>}
            {litvm.isError && <span className="btn-text text-[#FF8080]">Could not load LitVM balance.</span>}
            {litvm.data && (
              <span className="btn-text">
                You have{" "}
                <span className="btn-text text-[#CCFF00]">
                  {formatPoints(litvm.data.litvmAvailable)}
                </span>{" "}
                points on LitVM.
              </span>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor="claim-amount" className="btn-text text-white/70">
              Amount to convert
            </label>
            <Input
              id="claim-amount"
              inputMode="numeric"
              placeholder="0"
              value={amount}
              disabled={busy}
              onChange={(e) => setAmount(e.target.value.replace(/[^\d]/g, ""))}
              className="rounded-full border-white/25 bg-white/10 font-mono text-white placeholder:text-white/40"
            />
            {available !== null && (
              <button
                type="button"
                className="btn-text text-xs font-semibold text-[#CCFF00] hover:underline"
                disabled={busy}
                onClick={() => setAmount(available.toString())}
              >
                Max: {formatPoints(available)}
              </button>
            )}
          </div>

          {error && <p className="btn-text text-[#FF8080]">{error}</p>}

          <NetworkSwitcher tone="dark" />

          {busy ? (
            <div className="flex w-full flex-col items-center gap-3 rounded-full bg-white/10 px-6 py-4">
              <div className="flex gap-1.5" aria-hidden="true">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="size-2.5 animate-bounce rounded-full bg-[#CCFF00]"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </div>
              <p className="btn-text text-white">{stepLabel}…</p>
            </div>
          ) : (
            <Button
              className="btn fx-9 btn-pill btn-lime w-full py-6"
              disabled={!amountValid || !correctNetwork}
              onClick={() => void handleConvert()}
            >
              <span className="btn-label">Convert</span>
            </Button>
          )}
          {!correctNetwork && (
            <p className="btn-text text-center text-[#FF8080]">
              Claiming on-chain requires Base Mainnet.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
