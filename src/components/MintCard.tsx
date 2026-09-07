import { useCallback, useEffect, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/reui-spinner";

import {
  nftRead,
  readProvider,
  useMintStatus,
  useNftArtwork,
  useRefreshAll,
  useVouchers,
} from "@/hooks/useLitdex";
import { useWallet } from "@/hooks/useWallet";
import { PASS_CARD_IMAGES } from "@/lib/images";
import {
  NFT_ADDRESS,
  discountLabel,
  discountedPrice,
  formatUsdt,
  nftContract,
  parseWalletError,
  payTokenContract,
  type PayToken,
  type Voucher,
} from "@/lib/litdex";

const WALLET_LIMIT = 2;

function formatCountdown(msLeft: number) {
  const total = Math.max(0, Math.floor(msLeft / 1000));
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const mintStyle = {
  "--mint-surface": "oklch(1 0 0)",
  "--mint-muted": "oklch(0.97 0.005 260)",
  "--mint-border": "oklch(0.91 0.02 260)",
  "--mint-primary": "oklch(0.55 0.22 260)",
  "--mint-primary-light": "oklch(0.65 0.2 260)",
  "--mint-accent": "oklch(0.6 0.22 300)",
  "--mint-text": "oklch(0.2 0.02 260)",
  "--mint-text-muted": "oklch(0.55 0.04 260)",
  "--mint-success": "oklch(0.65 0.2 150)",
  "--mint-gradient-subtle":
    "linear-gradient(135deg, oklch(0.65 0.2 260 / 0.10), oklch(0.6 0.22 300 / 0.06))",
  "--mint-gradient-button":
    "linear-gradient(135deg, oklch(0.55 0.22 260), oklch(0.5 0.22 300))",
  "--mint-gradient-hero":
    "linear-gradient(135deg, oklch(0.97 0.01 260), oklch(0.95 0.02 300 / 0.35))",
  "--mint-gradient-premium":
    "linear-gradient(135deg, oklch(0.22 0.03 260), oklch(0.45 0.18 260))",
} as React.CSSProperties;

export function MintCard() {
  const { address, getSigner, correctNetwork, connect, connecting } = useWallet();
  const { data: mintStatus, isLoading, refetch: refetchStatus } = useMintStatus();
  const { data: voucherData, refetch: refetchVouchers } = useVouchers();
  const refreshAll = useRefreshAll();
  const [status, setStatus] = useState<string | null>(null);
  const [mintedId, setMintedId] = useState<bigint | null>(null);
  const { data: mintedArt, isLoading: mintedArtLoading } = useNftArtwork(
    mintedId ?? undefined,
  );

  const [passIndex, setPassIndex] = useState(0);
  const [loadedPasses, setLoadedPasses] = useState<string[]>([]);
  const markPassLoaded = useCallback(
    (label: string) =>
      setLoadedPasses((prev) =>
        prev.includes(label) ? prev : [...prev, label],
      ),
    [],
  );
  const passesReady = loadedPasses.length >= PASS_CARD_IMAGES.length;
  useEffect(() => {
    if (!passesReady) return;
    const timer = setInterval(
      () => setPassIndex((i) => (i + 1) % PASS_CARD_IMAGES.length),
      2600,
    );
    return () => clearInterval(timer);
  }, [passesReady]);
  const activePass =
    PASS_CARD_IMAGES[passIndex] ?? PASS_CARD_IMAGES[0] ?? null;

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const started = mintStatus?.publicMintStarted ?? false;
  const startsAt = (mintStatus?.publicMintStart ?? 0) * 1000;
  const countdown =
    startsAt > 0 ? formatCountdown(startsAt - now) : null;
  const price = mintStatus ? BigInt(mintStatus.priceUSDT) : null;
  const soldOut =
    !!mintStatus && mintStatus.supplyCap > 0 && mintStatus.totalMinted >= mintStatus.supplyCap;
  const busy = status !== null;
  const ownedCount = mintStatus?.walletPublicMintCount ?? 0;
  const limitReached = mintStatus?.walletLimitReached ?? false;
  const progress =
    mintStatus && mintStatus.supplyCap > 0
      ? (mintStatus.totalMinted / mintStatus.supplyCap) * 100
      : 0;

  const priorityVouchers = (voucherData?.vouchers ?? []).filter(
    (v) => v.category.toUpperCase() === "PRIORITY",
  );
  const priorityVoucher = priorityVouchers[0] ?? null;
  const voucherGroups = (() => {
    const map = new Map<string, Voucher[]>();
    for (const v of voucherData?.vouchers ?? []) {
      const key = v.category.toUpperCase();
      if (key === "PRIORITY") continue;
      map.set(key, [...(map.get(key) ?? []), v]);
    }
    return [...map.entries()];
  })();

  const [qtyByCategory, setQtyByCategory] = useState<Record<string, number>>({});
  const qtyFor = (category: string) => qtyByCategory[category] ?? 0;
  const setQty = (category: string, next: number, max: number) =>
    setQtyByCategory((prev) => ({
      ...prev,
      [category]: Math.max(0, Math.min(next, max)),
    }));

  const selectedVouchers = voucherGroups.flatMap(([category, vouchers]) =>
    vouchers.slice(0, Math.min(qtyFor(category), vouchers.length)),
  );
  const selectedCost =
    price !== null
      ? selectedVouchers.reduce(
          (sum, v) => sum + discountedPrice(price, v.discountBps),
          0n,
        )
      : null;

  const remainingPublic = Math.max(0, WALLET_LIMIT - ownedCount);
  const [publicQty, setPublicQty] = useState(1);
  const publicQtyClamped = Math.max(1, Math.min(publicQty, Math.max(remainingPublic, 1)));
  const [payToken, setPayToken] = useState<PayToken>("USDT");
  const [voucherPayToken, setVoucherPayToken] = useState<PayToken>("USDT");

  async function handleMint(quantity: number) {
    if (!address || price === null || quantity < 1) return;
    const totalCost = price * BigInt(quantity);
    try {
      const token = payTokenContract(payToken, readProvider());
      const allowance = await token.allowance(address, NFT_ADDRESS);
      const signer = await getSigner();
      if (allowance < totalCost) {
        setStatus("Approving…");
        const approveTx = await payTokenContract(payToken, signer).approve(NFT_ADDRESS, totalCost);
        await approveTx.wait();
      }
      setStatus("Minting…");
      const nft = nftContract(signer);
      const tx =
        payToken === "USDC"
          ? await nft.mintBatchUSDC(quantity)
          : await nft.mintBatch(quantity);
      await tx.wait();
      try {
        const next = await nftRead().nextTokenId();
        if (next > 1n) setMintedId(next - 1n);
      } catch {
        // artwork is optional
      }
      await refreshAll();
      await refetchStatus();
      toast.success(
        quantity > 1 ? `${quantity} NFTs minted` : "NFT minted",
      );
    } catch (err) {
      toast.error(parseWalletError(err, "Mint failed, try again."));
    } finally {
      setStatus(null);
    }
  }

  async function handleVoucherMint(vouchers: Voucher[]) {
    if (!address || price === null || vouchers.length === 0) return;
    const totalCost = vouchers.reduce(
      (sum, v) => sum + discountedPrice(price, v.discountBps),
      0n,
    );
    try {
      const token = payTokenContract(voucherPayToken, readProvider());
      const allowance = await token.allowance(address, NFT_ADDRESS);
      const signer = await getSigner();
      if (allowance < totalCost) {
        setStatus("Approving…");
        const approveTx = await payTokenContract(voucherPayToken, signer).approve(
          NFT_ADDRESS,
          totalCost,
        );
        await approveTx.wait();
      }
      setStatus("Minting…");
      const nft = nftContract(signer);
      const structs = vouchers.map(
        (v) => [v.wallet, v.discountBps, v.nonce] as [string, number, string],
      );
      const signatures = vouchers.map((v) => v.signature);
      const tx =
        vouchers.length === 1
          ? voucherPayToken === "USDC"
            ? await nft.mintWithVoucherUSDC(structs[0]!, signatures[0]!)
            : await nft.mintWithVoucher(structs[0]!, signatures[0]!)
          : voucherPayToken === "USDC"
            ? await nft.mintWithVouchersBatchUSDC(structs, signatures)
            : await nft.mintWithVouchersBatch(structs, signatures);
      await tx.wait();
      try {
        const next = await nftRead().nextTokenId();
        if (next > 1n) setMintedId(next - 1n);
      } catch {
        // artwork is optional
      }
      await refreshAll();
      await Promise.all([refetchStatus(), refetchVouchers()]);
      toast.success(
        `${vouchers.length} ${vouchers.length === 1 ? "NFT" : "NFTs"} minted with whitelist discounts`,
      );
    } catch (err) {
      toast.error(parseWalletError(err, "Voucher mint failed, try again."));
    } finally {
      setStatus(null);
    }
  }

  const publicStageCard = (
    <div className="rounded-[2rem] border border-[var(--mint-border)] bg-[var(--mint-surface)] p-5 shadow-sm md:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
            Public stage
          </p>
          <p className="font-sans text-2xl font-bold text-[var(--mint-text)]">
            ${price !== null ? formatUsdt(price) : "…"} {payToken}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-[var(--mint-border)] bg-[var(--mint-muted)] px-3 py-1.5">
          <span
            className={`size-2 rounded-full ${
              started ? "bg-[var(--mint-primary)]" : "bg-[var(--mint-success)]"
            }`}
          />
          <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-text)]">
            {started ? "Minting now" : "Not started"}
          </span>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-1 rounded-full border border-[var(--mint-border)] bg-[var(--mint-muted)] p-1">
          <span className="pl-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
            Pay with
          </span>
          {(["USDT", "USDC"] as const).map((token) => (
            <button
              key={token}
              type="button"
              disabled={busy}
              onClick={() => setPayToken(token)}
              className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest transition-all disabled:opacity-40 ${
                payToken === token
                  ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md"
                  : "text-[var(--mint-text-muted)] hover:text-[var(--mint-primary)]"
              }`}
            >
              {token}
            </button>
          ))}
        </div>

        <p className="font-mono text-[12px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
          {started
            ? "Minting now"
            : countdown
              ? `Starts in ${countdown}`
              : "Not scheduled"}
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2 rounded-full border border-[var(--mint-border)] bg-[var(--mint-muted)] p-1">
          <button
            aria-label="Decrease public mint quantity"
            disabled={publicQtyClamped <= 1 || busy}
            onClick={() => setPublicQty(publicQtyClamped - 1)}
            className="grid size-8 place-items-center rounded-full text-[var(--mint-text)] transition-all hover:bg-[var(--mint-surface)] hover:text-[var(--mint-primary)] active:scale-90 disabled:opacity-40"
          >
            <Minus className="size-3.5" />
          </button>
          <span className="min-w-6 text-center font-mono text-sm font-bold text-[var(--mint-text)]">
            {publicQtyClamped}
          </span>
          <button
            aria-label="Increase public mint quantity"
            disabled={publicQtyClamped >= remainingPublic || busy}
            onClick={() => setPublicQty(publicQtyClamped + 1)}
            className="grid size-8 place-items-center rounded-full text-[var(--mint-text)] transition-all hover:bg-[var(--mint-surface)] hover:text-[var(--mint-primary)] active:scale-90 disabled:opacity-40"
          >
            <Plus className="size-3.5" />
          </button>
        </div>

        <button
          disabled={
            !correctNetwork ||
            soldOut ||
            busy ||
            !mintStatus ||
            !started ||
            limitReached
          }
          onClick={() => void handleMint(publicQtyClamped)}
          className="rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-8 py-3.5 font-mono text-[13px] font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/25 active:translate-y-0 active:scale-[0.98] disabled:opacity-40 disabled:hover:transform-none"
        >
          {soldOut
            ? "Sold out"
            : !started
              ? "Mint when live"
              : limitReached
                ? "Limit reached"
                : status ??
                  `Mint ${publicQtyClamped} · ${
                    price !== null
                      ? formatUsdt(price * BigInt(publicQtyClamped))
                      : "…"
                  } ${payToken}`}
        </button>
      </div>

      <p className="mt-5 text-right font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
        Limit {WALLET_LIMIT} per wallet · You own {ownedCount}
      </p>
    </div>
  );

  return (
    <div
      id="mint"
      style={mintStyle}
      className="scroll-mt-24 rounded-[2.5rem] border border-[var(--mint-border)] bg-gradient-to-br from-slate-50 via-white to-indigo-50 p-6 shadow-2xl md:p-10"
    >
      <div className="grid gap-8 lg:grid-cols-2">
        {/* Left: pass-card carousel */}
        <div className="relative flex flex-col gap-4 lg:sticky lg:top-8 lg:self-start">
          <div className="relative aspect-square w-full overflow-hidden rounded-[2rem] border border-[var(--mint-border)] bg-[var(--mint-surface)] shadow-xl">
            {PASS_CARD_IMAGES.map((pass, i) => (
              <img
                key={pass.label}
                src={pass.src}
                alt={`Litdex pass card — ${pass.label}`}
                ref={(el) => {
                  if (el && el.complete) markPassLoaded(pass.label);
                }}
                onLoad={() => markPassLoaded(pass.label)}
                onError={() => markPassLoaded(pass.label)}
                className={`absolute inset-0 size-full object-cover transition-opacity duration-[900ms] ease-in-out ${
                  i === passIndex && passesReady ? "z-10 opacity-100" : "z-0 opacity-0"
                }`}
              />
            ))}
            {!passesReady && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-[var(--mint-surface)]">
                <Spinner className="size-8 text-[var(--mint-primary)]" />
                <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
                  Loading pass cards…
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-center gap-3">
            {PASS_CARD_IMAGES.map((pass, i) => (
              <button
                key={pass.label}
                type="button"
                aria-label={`Show ${pass.label} pass`}
                onClick={() => setPassIndex(i)}
                className={`h-2 rounded-full transition-all duration-500 ${
                  i === passIndex
                    ? "w-8 bg-[var(--mint-primary)]"
                    : "w-2 bg-[var(--mint-border)] hover:bg-[var(--mint-primary)]/40"
                }`}
              />
            ))}
            <span className="ml-2 rounded-full border border-[var(--mint-border)] bg-[var(--mint-surface)] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
              {activePass?.label}
            </span>
          </div>
        </div>

        {/* Right: mint controls */}
        <div className="flex flex-col gap-6">
          <div>
            <h3 className="font-sans text-2xl font-bold tracking-tight text-[var(--mint-text)] md:text-3xl">
              Mint a champion
            </h3>
            <span className="mt-3 block h-1 w-16 rounded-full bg-gradient-to-r from-blue-600 to-violet-600" />
            <p className="mt-4 font-sans text-sm font-medium text-[var(--mint-text-muted)]">
              Common rarity to start · Base Sepolia
            </p>
          </div>

          {/* Progress */}
          <div className="rounded-2xl border border-[var(--mint-border)] bg-[var(--mint-surface)] p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
                Items minted
              </p>
              <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-text)]">
                {isLoading || !mintStatus
                  ? "…"
                  : `${mintStatus.totalMinted} / ${mintStatus.supplyCap}`}
              </p>
            </div>
            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-[var(--mint-muted)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 transition-all duration-700"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
          </div>

          {/* Mint actions */}
          {address && (
            <div
              className={
                voucherData && voucherData.totalVouchers > 0
                  ? "grid gap-6 xl:grid-cols-2 items-start"
                  : "grid gap-6"
              }
            >
              {/* Whitelist */}
              {voucherData && voucherData.totalVouchers > 0 && (
                <div className="flex flex-col gap-4 rounded-[2rem] border border-[var(--mint-border)] bg-[var(--mint-surface)] p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-4 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest text-white shadow-sm">
                    Whitelist eligible
                  </span>
                  <p className="mt-2 font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
                    {voucherData.totalVouchers} discounted mint
                    {voucherData.totalVouchers === 1 ? "" : "s"} available
                  </p>
                </div>

                <div className="flex items-center gap-1 rounded-full border border-[var(--mint-border)] bg-[var(--mint-muted)] p-1">
                  <span className="pl-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
                    Pay with
                  </span>
                  {(["USDT", "USDC"] as const).map((token) => (
                    <button
                      key={token}
                      type="button"
                      disabled={busy}
                      onClick={() => setVoucherPayToken(token)}
                      className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest transition-all disabled:opacity-40 ${
                        voucherPayToken === token
                          ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md"
                          : "text-[var(--mint-text-muted)] hover:text-[var(--mint-primary)]"
                      }`}
                    >
                      {token}
                    </button>
                  ))}
                </div>
              </div>

              {/* Priority voucher */}
              {priorityVoucher && price !== null && (
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-blue-900 p-5 text-white shadow-md">
                  <div className="absolute -right-8 -top-8 size-32 rounded-full bg-[var(--mint-primary)]/20 blur-2xl" />
                  <div className="relative flex flex-wrap items-center justify-between gap-4">
                    <p className="font-sans text-base font-semibold">
                      You are eligible to mint at ${" "}
                      {formatUsdt(discountedPrice(price, priorityVoucher.discountBps))}{" "}
                      {voucherPayToken}
                    </p>
                    <button
                      disabled={!correctNetwork || busy}
                      onClick={() => void handleVoucherMint([priorityVoucher])}
                      className="rounded-full bg-white px-6 py-2.5 font-mono text-[12px] font-bold uppercase tracking-widest text-[var(--mint-text)] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 active:scale-[0.98] disabled:opacity-40 disabled:hover:transform-none"
                    >
                      {status ?? "Mint"}
                    </button>
                  </div>
                </div>
              )}

              {/* Category rows */}
              <div className="flex flex-col gap-3">
                {voucherGroups.map(([category, vouchers]) => {
                  const qty = Math.min(qtyFor(category), vouchers.length);
                  const first = vouchers[0]!;
                  return (
                    <div
                      key={category}
                      className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[var(--mint-border)] bg-[var(--mint-muted)] p-4 transition-shadow duration-300 hover:shadow-sm"
                    >
                      <div>
                        <p className="font-mono text-sm font-bold uppercase tracking-widest text-[var(--mint-text)]">
                          {category} x {vouchers.length}
                        </p>
                        <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-primary)]">
                          {discountLabel(first.discountBps)} off
                          {price !== null
                            ? ` · $${formatUsdt(discountedPrice(price, first.discountBps))} ${voucherPayToken}`
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 rounded-full border border-[var(--mint-border)] bg-[var(--mint-surface)] p-1">
                        <button
                          aria-label={`Decrease ${category} quantity`}
                          disabled={qty <= 0 || busy}
                          onClick={() => setQty(category, qty - 1, vouchers.length)}
                          className="grid size-8 place-items-center rounded-full text-[var(--mint-text)] transition-all hover:bg-[var(--mint-muted)] hover:text-[var(--mint-primary)] active:scale-90 disabled:opacity-40"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="min-w-6 text-center font-mono text-sm font-bold text-[var(--mint-text)]">
                          {qty}
                        </span>
                        <button
                          aria-label={`Increase ${category} quantity`}
                          disabled={qty >= vouchers.length || busy}
                          onClick={() => setQty(category, qty + 1, vouchers.length)}
                          className="grid size-8 place-items-center rounded-full text-[var(--mint-text)] transition-all hover:bg-[var(--mint-muted)] hover:text-[var(--mint-primary)] active:scale-90 disabled:opacity-40"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <button
                disabled={
                  !correctNetwork ||
                  busy ||
                  price === null ||
                  selectedVouchers.length === 0
                }
                onClick={() => void handleVoucherMint(selectedVouchers)}
                className="mt-1 w-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3.5 font-mono text-[13px] font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/25 active:translate-y-0 active:scale-[0.98] disabled:opacity-40 disabled:hover:transform-none"
              >
                {selectedVouchers.length === 0
                  ? "Select vouchers to mint"
                  : status ??
                    `Mint ${selectedVouchers.length} in one transaction · $${
                      selectedCost !== null ? formatUsdt(selectedCost) : "…"
                    } ${voucherPayToken}`}
              </button>
                </div>
              )}
            </div>
          )}


          {/* Not connected */}
          {!address && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-[var(--mint-border)] bg-[var(--mint-surface)] p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
                    Whitelist mint
                  </p>
                  <p className="mt-2 flex items-center gap-2 font-mono text-[12px] font-bold uppercase tracking-widest text-[var(--mint-primary)]">
                    <span className="inline-block size-2 rounded-full bg-[var(--mint-success)]" />
                    Open
                  </p>
                </div>
                <div className="rounded-2xl border border-[var(--mint-border)] bg-[var(--mint-surface)] p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
                    Public mint
                  </p>
                  <p className="mt-2 font-mono text-[12px] font-bold uppercase tracking-widest text-[var(--mint-text)]">
                    {started
                      ? "Live now"
                      : countdown
                        ? `Starts in ${countdown}`
                        : "Not scheduled"}
                  </p>
                </div>
              </div>
              <button
                onClick={() => void connect()}
                disabled={connecting}
                className="w-full rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-6 py-3.5 font-mono text-[13px] font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/25 active:translate-y-0 active:scale-[0.98] disabled:opacity-40 disabled:hover:transform-none"
              >
                {connecting ? "Connecting…" : "Connect wallet to mint"}
              </button>
            </div>
          )}

          {/* Public stage */}
          {address && (
            <div className="rounded-[2rem] border border-[var(--mint-border)] bg-[var(--mint-surface)] p-5 shadow-sm md:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
                    Public stage
                  </p>
                  <p className="font-sans text-2xl font-bold text-[var(--mint-text)]">
                    ${price !== null ? formatUsdt(price) : "…"} {payToken}
                  </p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-[var(--mint-border)] bg-[var(--mint-muted)] px-3 py-1.5">
                  <span
                    className={`size-2 rounded-full ${
                      started ? "bg-[var(--mint-primary)]" : "bg-[var(--mint-success)]"
                    }`}
                  />
                  <span className="font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-text)]">
                    {started ? "Minting now" : "Not started"}
                  </span>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-1 rounded-full border border-[var(--mint-border)] bg-[var(--mint-muted)] p-1">
                  <span className="pl-2 font-mono text-[10px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
                    Pay with
                  </span>
                  {(["USDT", "USDC"] as const).map((token) => (
                    <button
                      key={token}
                      type="button"
                      disabled={busy}
                      onClick={() => setPayToken(token)}
                      className={`rounded-full px-3 py-1.5 font-mono text-[11px] font-bold uppercase tracking-widest transition-all disabled:opacity-40 ${
                        payToken === token
                          ? "bg-gradient-to-r from-blue-600 to-violet-600 text-white shadow-md"
                          : "text-[var(--mint-text-muted)] hover:text-[var(--mint-primary)]"
                      }`}
                    >
                      {token}
                    </button>
                  ))}
                </div>

                <p className="font-mono text-[12px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
                  {started
                    ? "Minting now"
                    : countdown
                      ? `Starts in ${countdown}`
                      : "Not scheduled"}
                </p>
              </div>

              <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-2 rounded-full border border-[var(--mint-border)] bg-[var(--mint-muted)] p-1">
                  <button
                    aria-label="Decrease public mint quantity"
                    disabled={publicQtyClamped <= 1 || busy}
                    onClick={() => setPublicQty(publicQtyClamped - 1)}
                    className="grid size-8 place-items-center rounded-full text-[var(--mint-text)] transition-all hover:bg-[var(--mint-surface)] hover:text-[var(--mint-primary)] active:scale-90 disabled:opacity-40"
                  >
                    <Minus className="size-3.5" />
                  </button>
                  <span className="min-w-6 text-center font-mono text-sm font-bold text-[var(--mint-text)]">
                    {publicQtyClamped}
                  </span>
                  <button
                    aria-label="Increase public mint quantity"
                    disabled={publicQtyClamped >= remainingPublic || busy}
                    onClick={() => setPublicQty(publicQtyClamped + 1)}
                    className="grid size-8 place-items-center rounded-full text-[var(--mint-text)] transition-all hover:bg-[var(--mint-surface)] hover:text-[var(--mint-primary)] active:scale-90 disabled:opacity-40"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                <button
                  disabled={
                    !correctNetwork ||
                    soldOut ||
                    busy ||
                    !mintStatus ||
                    !started ||
                    limitReached
                  }
                  onClick={() => void handleMint(publicQtyClamped)}
                  className="rounded-full bg-gradient-to-r from-blue-600 to-violet-600 px-8 py-3.5 font-mono text-[13px] font-bold uppercase tracking-widest text-white shadow-lg shadow-blue-600/20 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-600/25 active:translate-y-0 active:scale-[0.98] disabled:opacity-40 disabled:hover:transform-none"
                >
                  {soldOut
                    ? "Sold out"
                    : !started
                      ? "Mint when live"
                      : limitReached
                        ? "Limit reached"
                        : status ??
                          `Mint ${publicQtyClamped} · $${
                            price !== null
                              ? formatUsdt(price * BigInt(publicQtyClamped))
                              : "…"
                          } ${payToken}`}
                </button>
              </div>

              <p className="mt-5 text-right font-mono text-[11px] font-bold uppercase tracking-widest text-[var(--mint-text-muted)]">
                Limit {WALLET_LIMIT} per wallet · You own {ownedCount}
              </p>
            </div>
          )}

          {mintedId !== null && (
            <p className="font-mono text-xs font-bold text-[var(--mint-text-muted)]">
              {mintedArtLoading
                ? "Loading artwork…"
                : `Champion #${mintedId.toString()} minted!`}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
