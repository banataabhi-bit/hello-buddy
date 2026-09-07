import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PredictGame, isMaxTier } from "@/components/PredictGame";
import { LoadingBlock } from "@/components/LoadingImage";
import { useOwnedNfts } from "@/hooks/useLitdex";
import { useWallet } from "@/hooks/useWallet";
import { formatTierLabel, RARITY_NAMES, type OwnedNft } from "@/lib/litdex";
import { ChevronLeft, Gamepad2 } from "lucide-react";

function ChampionRow({
  nft,
  onSelect,
}: {
  nft: OwnedNft;
  onSelect: (nft: OwnedNft) => void;
}) {
  return (
    <button
      onClick={() => onSelect(nft)}
      className="btn fx-9 flex w-full items-center justify-between rounded-[1.5rem] border-2 border-black/10 bg-[#F4F4F2] p-4 text-left transition-colors hover:border-[#0038FF] hover:bg-white"
    >
      <div className="space-y-1">
        <p className="btn-text text-black">Champion #{nft.tokenId.toString().padStart(4, "0")}</p>
        <p className="btn-text text-black/60">
          {RARITY_NAMES[nft.rarity]} · Tier {nft.level + 1}
        </p>
      </div>
      <span className="btn fx-9 btn-pill btn-lime shrink-0">
        <span className="btn-label">Play</span>
      </span>
    </button>
  );
}

export function GameModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { address, connect, connecting, hasWallet, correctNetwork, switchNetwork } = useWallet();
  const { data, isLoading } = useOwnedNfts();
  const [selected, setSelected] = useState<OwnedNft | null>(null);

  const eligible = (data ?? []).filter(isMaxTier);

  const handleClose = (v: boolean) => {
    if (!v) setSelected(null);
    onOpenChange(v);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto rounded-[2rem] border-0 bg-white p-0">
        <div className="p-6 md:p-10">
          <DialogHeader className="mb-6 text-left">
            <DialogTitle className="flex items-center gap-3 text-2xl font-black uppercase tracking-tight text-black">
              <Gamepad2 className="size-7 text-[#0038FF]" />
              Predict the number
            </DialogTitle>
          </DialogHeader>

          {!address ? (
            <div className="rounded-[2rem] border-2 border-dashed border-black/15 bg-[#F4F4F2] p-10 text-center">
              <p className="btn-text text-black">Connect your wallet to play the prediction game.</p>
              <button
                onClick={() => void connect()}
                disabled={connecting}
                className="btn fx-9 btn-pill btn-lime mt-6"
              >
                <span className="btn-label">
                  {connecting ? "Connecting…" : hasWallet ? "Connect wallet" : "Install wallet"}
                </span>
              </button>
            </div>
          ) : !correctNetwork ? (
            <div className="rounded-[2rem] border-2 border-dashed border-black/15 bg-[#F4F4F2] p-10 text-center">
              <p className="btn-text text-black/60">
                You&apos;re on another network — switch to Base Sepolia to play.
              </p>
              <button
                onClick={() => void switchNetwork()}
                className="btn fx-9 btn-pill btn-blue mt-6"
              >
                <span className="btn-label">switch to base</span>
              </button>
            </div>
          ) : isLoading ? (
            <LoadingBlock label="Scanning champions…" />
          ) : eligible.length === 0 ? (
            <div className="rounded-[2rem] border-2 border-dashed border-black/15 bg-[#F4F4F2] p-10 text-center">
              <p className="btn-text text-black">
                You need a max-tier champion to play.
              </p>
              <p className="btn-text mt-2 text-black/60">
                Reach Common Tier 9, Rare Tier 5, Epic Tier 3, or Legend.
              </p>
            </div>
          ) : selected ? (
            <div className="space-y-4">
              <button
                onClick={() => setSelected(null)}
                className="btn-text inline-flex items-center gap-1 text-[#0038FF] hover:underline"
              >
                <ChevronLeft className="size-4" /> Back to champions
              </button>
              <div className="rounded-[2rem] border-2 border-black/10 bg-[#F4F4F2] p-6">
                <p className="btn-text mb-4 text-black">
                  Playing with Champion #{selected.tokenId.toString().padStart(4, "0")} ·{" "}
                  {RARITY_NAMES[selected.rarity]} · Tier {selected.level + 1}
                </p>
                <PredictGame nft={selected} />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="btn-text text-black/60">
                {eligible.length} champion{eligible.length === 1 ? "" : "s"} ready to play
              </p>
              {eligible.map((nft) => (
                <ChampionRow key={nft.tokenId.toString()} nft={nft} onSelect={setSelected} />
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
