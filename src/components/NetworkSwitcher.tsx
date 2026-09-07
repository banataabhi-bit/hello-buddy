import { useState } from "react";
import { toast } from "sonner";
import { useWallet } from "@/hooks/useWallet";
import { BASE_MAINNET, LITVM, chainName, parseWalletError, type ChainConfig } from "@/lib/litdex";

export function NetworkSwitcher({ tone = "light" }: { tone?: "light" | "dark" }) {
  const { chainId, switchNetwork, address } = useWallet();
  const [pending, setPending] = useState<number | null>(null);

  if (!address) return null;

  const handle = async (target: ChainConfig) => {
    setPending(target.chainId);
    try {
      await switchNetwork(target);
    } catch (err) {
      toast.error(parseWalletError(err, `Could not switch to ${target.chainName}.`));
    } finally {
      setPending(null);
    }
  };

  const labelClass = tone === "dark" ? "text-white/70" : "text-black/60";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className={`text-xs font-semibold ${labelClass}`}>
        Network: {chainName(chainId)}
        {chainId !== null && ` (${chainId})`}
      </span>
      {[BASE_MAINNET, LITVM].map((c) => {
        const active = chainId === c.chainId;
        return (
          <button
            key={c.chainId}
            type="button"
            disabled={active || pending !== null}
            onClick={() => void handle(c)}
            className={`btn fx-9 btn-pill ${active ? "btn-lime" : "btn-blue"}`}
          >
            <span className="btn-label">{pending === c.chainId ? "Switching…" : `Switch to ${c.chainName}`}</span>
          </button>
        );
      })}
    </div>
  );
}
